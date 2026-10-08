// FLIP liquid solver and liquid renderer written from scratch in Go (standard library only).
// A glass hourglass full of two-tone liquid turns over twice; the liquid pours through the neck and marbles.
//
//	go run . <out_dir> [frames] [workers]
//
// Writes PPM frames (1280x720, 30 fps) that FFmpeg encodes to the final clip.
package main

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"strconv"
	"sync"
	"time"
)

const (
	fluidCell = 0
	airCell   = 1
	solidCell = 2
	gravity   = 9.81
	// Hourglass in meters (glass frame, origin at the center): half width, half height, neck, flare length.
	hgA, hgB, hgNeck, hgC = 0.46, 0.80, 0.05, 0.46
	wallT                 = 0.014
	buoy                  = 0.30
)

func clampf(x, a, b float64) float64 { return math.Max(a, math.Min(b, x)) }
func clampi(x, a, b int) int         { return max(a, min(b, x)) }
func smooth(t float64) float64       { t = clampf(t, 0, 1); return t * t * (3 - 2*t) }
func smoother(t float64) float64     { t = clampf(t, 0, 1); return t * t * t * (t*(t*6-15) + 10) }

// hgWidth is the inner half width of the hourglass at height y, and its slope.
func hgWidth(y float64) (float64, float64) {
	ay := math.Abs(y)
	t := clampf(ay/hgC, 0, 1)
	w := hgNeck + (hgA-hgNeck)*math.Sin(t*math.Pi/2)
	slope := 0.0
	if ay < hgC {
		slope = (hgA - hgNeck) * math.Cos(t*math.Pi/2) * math.Pi / 2 / hgC
	}
	return w, slope
}

// hgSDF is the approximate signed distance to the inner glass surface (negative inside).
func hgSDF(x, y float64) float64 {
	w, sl := hgWidth(y)
	side := (math.Abs(x) - w) / math.Sqrt(1+sl*sl)
	end := math.Abs(y) - hgB
	k := 0.06
	return 0.5 * (side + end + math.Sqrt((side-end)*(side-end)+k*k))
}

// angle is the hourglass rotation at time t: two eased half turns.
func angle(t float64) float64 {
	return math.Pi*smoother((t-0.7)/1.8) + math.Pi*smoother((t-4.4)/1.8)
}

// Sim is a 2D FLIP fluid on a MAC grid (index i*ny+j, y up) in the frame of the turning hourglass.
type Sim struct {
	nx, ny               int
	h, invH, wd, hd      float64
	u, v, du, dv, pu, pv []float64
	s, pd                []float64
	ct                   []uint8
	rest, r              float64
	px, py, vx, vy, dye  []float64
	pinv                 float64
	pnx, pny             int
	cnt, first, ids      []int32
}

// newSim fills the lower bulb with hex-packed particles: cyan below, coral above.
func newSim(h float64) *Sim {
	s := &Sim{h: h, invH: 1 / h}
	s.nx = int(math.Ceil((2*hgA+8*h)/h)) + 1
	s.ny = int(math.Ceil((2*hgB+8*h)/h)) + 1
	s.wd, s.hd = float64(s.nx)*h, float64(s.ny)*h
	n := s.nx * s.ny
	for _, p := range []*[]float64{&s.u, &s.v, &s.du, &s.dv, &s.pu, &s.pv, &s.s, &s.pd} {
		*p = make([]float64, n)
	}
	s.ct = make([]uint8, n)
	s.r = 0.3 * h
	s.pinv = 1 / (2.2 * s.r)
	s.pnx = int(s.wd*s.pinv) + 1
	s.pny = int(s.hd*s.pinv) + 1
	s.cnt = make([]int32, s.pnx*s.pny)
	s.first = make([]int32, s.pnx*s.pny+1)
	for i := 1; i < s.nx-1; i++ {
		for j := 1; j < s.ny-1; j++ {
			xt, yt := (float64(i)+0.5)*h-s.wd/2, (float64(j)+0.5)*h-s.hd/2
			if hgSDF(xt, yt) < 0 {
				s.s[i*s.ny+j] = 1
			}
		}
	}
	dx := 2 * s.r
	dy := math.Sqrt(3) / 2 * dx
	for j := 0; ; j++ {
		y := s.r + float64(j)*dy
		if y > s.hd {
			break
		}
		off := 0.0
		if j%2 == 1 {
			off = s.r
		}
		for i := 0; ; i++ {
			x := s.r + off + float64(i)*dx
			if x > s.wd {
				break
			}
			xt, yt := x-s.wd/2, y-s.hd/2
			if yt < -0.13 && hgSDF(xt, yt) < -1.5*s.r {
				s.px = append(s.px, x)
				s.py = append(s.py, y)
				d := 0.0
				if yt > -0.43 {
					d = 1
				}
				s.dye = append(s.dye, d)
			}
		}
	}
	s.vx = make([]float64, len(s.px))
	s.vy = make([]float64, len(s.px))
	s.ids = make([]int32, len(s.px))
	return s
}

// step advances by dt at time t. Gravity turns with the glass; Coriolis, centrifugal and
// Euler forces account for the rotating frame. The coral liquid is lighter than the cyan one
// (Boussinesq buoyancy), so after each turn it rises back through the cyan in plumes.
func (s *Sim) step(t, dt float64) {
	th := angle(t)
	e := 1e-3
	om := (angle(t+e) - angle(t-e)) / (2 * e)
	al := (angle(t+e) - 2*th + angle(t-e)) / (e * e)
	gx, gy := -gravity*math.Sin(th), -gravity*math.Cos(th)
	cx, cy := s.wd/2, s.hd/2
	for i := range s.px {
		rx, ry := s.px[i]-cx, s.py[i]-cy
		b := 1 + buoy*(1-2*s.dye[i])
		ax := gx*b + 2*om*s.vy[i] + om*om*rx + al*ry
		ay := gy*b - 2*om*s.vx[i] + om*om*ry - al*rx
		s.vx[i] += ax * dt
		s.vy[i] += ay * dt
		s.px[i] += s.vx[i] * dt
		s.py[i] += s.vy[i] * dt
	}
	s.pushApart(2)
	s.collide()
	s.transfer(true, 0)
	s.density()
	s.solve(80, 1.9)
	s.transfer(false, 0.88)
}

// pushApart separates overlapping particles using a spatial hash.
func (s *Sim) pushApart(iters int) {
	clear(s.cnt)
	np := len(s.px)
	cell := func(x, y float64) int {
		return clampi(int(x*s.pinv), 0, s.pnx-1)*s.pny + clampi(int(y*s.pinv), 0, s.pny-1)
	}
	for i := 0; i < np; i++ {
		s.cnt[cell(s.px[i], s.py[i])]++
	}
	var acc int32
	for i := range s.cnt {
		acc += s.cnt[i]
		s.first[i] = acc
	}
	s.first[len(s.cnt)] = acc
	for i := 0; i < np; i++ {
		c := cell(s.px[i], s.py[i])
		s.first[c]--
		s.ids[s.first[c]] = int32(i)
	}
	minD := 2 * s.r
	minD2 := minD * minD
	for it := 0; it < iters; it++ {
		for i := 0; i < np; i++ {
			px, py := s.px[i], s.py[i]
			pxi, pyi := int(px*s.pinv), int(py*s.pinv)
			x0, y0 := max(pxi-1, 0), max(pyi-1, 0)
			x1, y1 := min(pxi+1, s.pnx-1), min(pyi+1, s.pny-1)
			for xi := x0; xi <= x1; xi++ {
				for yi := y0; yi <= y1; yi++ {
					c := xi*s.pny + yi
					for k := s.first[c]; k < s.first[c+1]; k++ {
						id := int(s.ids[k])
						if id == i {
							continue
						}
						dx, dy := s.px[id]-px, s.py[id]-py
						d2 := dx*dx + dy*dy
						if d2 > minD2 || d2 == 0 {
							continue
						}
						d := math.Sqrt(d2)
						sc := 0.5 * (minD - d) / d
						dx *= sc
						dy *= sc
						s.px[i] -= dx
						s.py[i] -= dy
						s.px[id] += dx
						s.py[id] += dy
					}
				}
			}
		}
	}
}

// collide pushes particles back inside the glass along the distance gradient and removes outward velocity.
func (s *Sim) collide() {
	r := s.r
	const e = 1e-3
	for i := range s.px {
		xt, yt := s.px[i]-s.wd/2, s.py[i]-s.hd/2
		d := hgSDF(xt, yt)
		if d <= -r {
			continue
		}
		nx := hgSDF(xt+e, yt) - hgSDF(xt-e, yt)
		ny := hgSDF(xt, yt+e) - hgSDF(xt, yt-e)
		l := math.Hypot(nx, ny) + 1e-12
		nx, ny = nx/l, ny/l
		xt -= nx * (d + r)
		yt -= ny * (d + r)
		if vn := s.vx[i]*nx + s.vy[i]*ny; vn > 0 {
			s.vx[i] -= vn * nx
			s.vy[i] -= vn * ny
		}
		s.px[i], s.py[i] = xt+s.wd/2, yt+s.hd/2
	}
}

// transfer moves velocities particles to grid (toGrid) or grid to particles with a PIC/FLIP blend.
func (s *Sim) transfer(toGrid bool, flip float64) {
	n, h, h1, h2 := s.ny, s.h, s.invH, 0.5*s.h
	np := len(s.px)
	if toGrid {
		copy(s.pu, s.u)
		copy(s.pv, s.v)
		clear(s.du)
		clear(s.dv)
		clear(s.u)
		clear(s.v)
		for i := range s.ct {
			if s.s[i] == 0 {
				s.ct[i] = solidCell
			} else {
				s.ct[i] = airCell
			}
		}
		for i := 0; i < np; i++ {
			c := clampi(int(s.px[i]*h1), 0, s.nx-1)*n + clampi(int(s.py[i]*h1), 0, s.ny-1)
			if s.ct[c] == airCell {
				s.ct[c] = fluidCell
			}
		}
	}
	for comp := 0; comp < 2; comp++ {
		dx, dy := 0.0, h2
		f, pf, d, pvel, off := s.u, s.pu, s.du, s.vx, n
		if comp == 1 {
			dx, dy = h2, 0.0
			f, pf, d, pvel, off = s.v, s.pv, s.dv, s.vy, 1
		}
		for i := 0; i < np; i++ {
			x := clampf(s.px[i], h, float64(s.nx-1)*h)
			y := clampf(s.py[i], h, float64(s.ny-1)*h)
			x0 := min(int((x-dx)*h1), s.nx-2)
			tx := ((x - dx) - float64(x0)*h) * h1
			x1 := min(x0+1, s.nx-2)
			y0 := min(int((y-dy)*h1), s.ny-2)
			ty := ((y - dy) - float64(y0)*h) * h1
			y1 := min(y0+1, s.ny-2)
			sx, sy := 1-tx, 1-ty
			w := [4]float64{sx * sy, tx * sy, tx * ty, sx * ty}
			c := [4]int{x0*n + y0, x1*n + y0, x1*n + y1, x0*n + y1}
			if toGrid {
				for k := 0; k < 4; k++ {
					f[c[k]] += pvel[i] * w[k]
					d[c[k]] += w[k]
				}
				continue
			}
			var dsum, pic, corr float64
			for k := 0; k < 4; k++ {
				if s.ct[c[k]] != airCell || s.ct[c[k]-off] != airCell {
					dsum += w[k]
					pic += w[k] * f[c[k]]
					corr += w[k] * (f[c[k]] - pf[c[k]])
				}
			}
			if dsum > 0 {
				pvel[i] = (1-flip)*(pic/dsum) + flip*(pvel[i]+corr/dsum)
			}
		}
		if toGrid {
			for i := range f {
				if d[i] > 0 {
					f[i] /= d[i]
				}
			}
		}
	}
	if toGrid {
		for i := 0; i < s.nx; i++ {
			for j := 0; j < s.ny; j++ {
				c := i*n + j
				solid := s.ct[c] == solidCell
				if solid || (i > 0 && s.ct[c-n] == solidCell) {
					s.u[c] = s.pu[c]
				}
				if solid || (j > 0 && s.ct[c-1] == solidCell) {
					s.v[c] = s.pv[c]
				}
			}
		}
	}
}

// density counts particles per cell; the first call stores the rest density (interior cells only)
// used for drift correction.
func (s *Sim) density() {
	n, h, h1, h2 := s.ny, s.h, s.invH, 0.5*s.h
	clear(s.pd)
	for i := range s.px {
		x := clampf(s.px[i], h, float64(s.nx-1)*h)
		y := clampf(s.py[i], h, float64(s.ny-1)*h)
		x0 := int((x - h2) * h1)
		tx := ((x - h2) - float64(x0)*h) * h1
		x1 := min(x0+1, s.nx-2)
		y0 := int((y - h2) * h1)
		ty := ((y - h2) - float64(y0)*h) * h1
		y1 := min(y0+1, s.ny-2)
		sx, sy := 1-tx, 1-ty
		s.pd[x0*n+y0] += sx * sy
		s.pd[x1*n+y0] += tx * sy
		s.pd[x1*n+y1] += tx * ty
		s.pd[x0*n+y1] += sx * ty
	}
	if s.rest == 0 {
		sum, num := 0.0, 0
		for i := 1; i < s.nx-1; i++ {
			for j := 1; j < s.ny-1; j++ {
				c := i*n + j
				if s.ct[c] == fluidCell && s.ct[c-1] == fluidCell && s.ct[c+1] == fluidCell && s.ct[c-n] == fluidCell && s.ct[c+n] == fluidCell {
					sum += s.pd[c]
					num++
				}
			}
		}
		if num > 0 {
			s.rest = sum / float64(num)
		}
	}
}

// solve makes the grid velocity divergence free with over-relaxed Gauss-Seidel,
// pushing apart cells that hold more particles than at rest.
func (s *Sim) solve(iters int, omega float64) {
	n := s.ny
	copy(s.pu, s.u)
	copy(s.pv, s.v)
	for it := 0; it < iters; it++ {
		for i := 1; i < s.nx-1; i++ {
			for j := 1; j < s.ny-1; j++ {
				c := i*n + j
				if s.ct[c] != fluidCell {
					continue
				}
				sx0, sx1, sy0, sy1 := s.s[c-n], s.s[c+n], s.s[c-1], s.s[c+1]
				st := sx0 + sx1 + sy0 + sy1
				if st == 0 {
					continue
				}
				div := s.u[c+n] - s.u[c] + s.v[c+1] - s.v[c]
				if s.rest > 0 {
					if comp := s.pd[c] - s.rest; comp > 0 {
						div -= comp
					}
				}
				p := -div / st * omega
				s.u[c] -= sx0 * p
				s.u[c+n] += sx1 * p
				s.v[c] -= sy0 * p
				s.v[c+1] += sy1 * p
			}
		}
	}
}

// ---------- rendering ----------

const (
	W, H = 1280, 720
	PXM  = 368.0
	RK   = 5.0
)

type rgb struct{ r, g, b float64 }

func mix(a, b rgb, t float64) rgb {
	return rgb{a.r + (b.r-a.r)*t, a.g + (b.g-a.g)*t, a.b + (b.b-a.b)*t}
}
func (a rgb) mul(k float64) rgb { return rgb{a.r * k, a.g * k, a.b * k} }
func (a rgb) add(b rgb) rgb     { return rgb{a.r + b.r, a.g + b.g, a.b + b.b} }

var (
	cBg    = rgb{11.0 / 255, 11.0 / 255, 16.0 / 255}
	cCream = rgb{0.96, 0.93, 0.86}
	cCyan  = rgb{0.16, 0.72, 0.98}
	cCoral = rgb{1.0, 0.36, 0.20}
	cNavy  = rgb{0.03, 0.06, 0.20}
)

// Ren draws the liquid as a smoothed particle field (metaballs) in the glass frame, then turns it onto the screen.
type Ren struct {
	cw, ch, hw, hh  int
	dens, dye, dist []float64
	mixq, tmp, aer  []float64
	gx, gy          []float64
	img             []rgb
	T, F0           float64
	cosT, sinT      float64
}

func newRen(s *Sim) *Ren {
	r := &Ren{}
	r.cw, r.ch = int(math.Ceil(s.wd*PXM)), int(math.Ceil(s.hd*PXM))
	r.hw, r.hh = r.cw/2+2, r.ch/2+2
	n := r.hw * r.hh
	r.dens, r.dye, r.dist = make([]float64, n), make([]float64, n), make([]float64, n)
	r.mixq, r.tmp, r.aer = make([]float64, n), make([]float64, n), make([]float64, n)
	r.gx, r.gy = make([]float64, n), make([]float64, n)
	r.img = make([]rgb, W*H)
	dx := 2 * s.r
	dy := math.Sqrt(3) / 2 * dx
	perPx := 1 / (dx * dy * (PXM / 2) * (PXM / 2))
	r.F0 = perPx * math.Pi * RK * RK / 4
	r.T = 0.36 * r.F0
	return r
}

// field samples a half-resolution canvas field (bilinear) at canvas pixel (x, y); zero outside.
func (r *Ren) field(a []float64, x, y float64) float64 {
	hx, hy := x/2-0.5, y/2-0.5
	if hx < 0 || hy < 0 || hx >= float64(r.hw-1) || hy >= float64(r.hh-1) {
		return 0
	}
	ix, iy := int(hx), int(hy)
	fx, fy := hx-float64(ix), hy-float64(iy)
	i := iy*r.hw + ix
	return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy) + (a[i+r.hw]*(1-fx)+a[i+r.hw+1]*fx)*fy
}

// toScreen maps a canvas pixel (glass frame, y down) to the screen; toCanvas is its inverse.
func (r *Ren) toScreen(x, y float64) (float64, float64) {
	ax, ay := x-float64(r.cw)/2, y-float64(r.ch)/2
	return W/2 + r.cosT*ax + r.sinT*ay, H/2 - r.sinT*ax + r.cosT*ay
}
func (r *Ren) toCanvas(x, y float64) (float64, float64) {
	dx, dy := x-W/2, y-H/2
	return float64(r.cw)/2 + r.cosT*dx - r.sinT*dy, float64(r.ch)/2 + r.sinT*dx + r.cosT*dy
}

// vecToScreen turns a canvas direction into a screen direction.
func (r *Ren) vecToScreen(x, y float64) (float64, float64) {
	return r.cosT*x + r.sinT*y, -r.sinT*x + r.cosT*y
}

func (r *Ren) bg(x, y float64) rgb {
	d := math.Hypot((x-W/2)/W, (y-H/2)/H)
	return mix(rgb{0.075, 0.08, 0.12}, cBg, smooth(d*1.9))
}

func (r *Ren) draw(s *Sim, t float64, workers int) {
	th := angle(t)
	r.cosT, r.sinT = math.Cos(th), math.Sin(th)
	clear(r.dens)
	clear(r.dye)
	for i := range s.px {
		cx, cy := s.px[i]*PXM/2, (s.hd-s.py[i])*PXM/2
		for iy := int(cy - RK); iy <= int(cy+RK)+1; iy++ {
			if iy < 0 || iy >= r.hh {
				continue
			}
			for ix := int(cx - RK); ix <= int(cx+RK)+1; ix++ {
				if ix < 0 || ix >= r.hw {
					continue
				}
				dx, dy := float64(ix)+0.5-cx, float64(iy)+0.5-cy
				q := 1 - (dx*dx+dy*dy)/(RK*RK)
				if q <= 0 {
					continue
				}
				w := q * q * q
				r.dens[iy*r.hw+ix] += w
				r.dye[iy*r.hw+ix] += w * s.dye[i]
			}
		}
	}
	for y := 1; y < r.hh-1; y++ {
		for x := 1; x < r.hw-1; x++ {
			i := y*r.hw + x
			r.gx[i] = 0.5 * (r.dens[i+1] - r.dens[i-1])
			r.gy[i] = 0.5 * (r.dens[i+r.hw] - r.dens[i-r.hw])
		}
	}
	// Dye ratio blurred over a few cells, so mixing reads as marbled bands rather than particle grain.
	for i := range r.mixq {
		if r.dens[i] > 1e-3 {
			r.mixq[i] = r.dye[i] / r.dens[i]
		} else {
			r.mixq[i] = 0.5
		}
	}
	blurBox(r.mixq, r.tmp, r.hw, r.hh, 3)
	blurBox(r.mixq, r.tmp, r.hw, r.hh, 3)
	// Wide density: above a flat surface it stays under half the rest density, inside an air
	// pocket enclosed by liquid it goes over, so only enclosed pockets get the frothy fill.
	copy(r.aer, r.dens)
	blurBox(r.aer, r.tmp, r.hw, r.hh, 8)
	blurBox(r.aer, r.tmp, r.hw, r.hh, 8)
	// Distance to the free surface (chamfer transform); glass counts as liquid so only air makes it shallow.
	for y := 0; y < r.hh; y++ {
		for x := 0; x < r.hw; x++ {
			xt, yt := (float64(x)*2+1)/PXM-s.wd/2, s.hd/2-(float64(y)*2+1)/PXM
			if r.dens[y*r.hw+x] > r.T || hgSDF(xt, yt) > 0 {
				r.dist[y*r.hw+x] = 1e9
			} else {
				r.dist[y*r.hw+x] = 0
			}
		}
	}
	chamfer(r.dist, r.hw, r.hh)
	L := norm3(-0.5, -0.62, 0.62)
	Hh := norm3(L[0], L[1], L[2]+1)
	var wg sync.WaitGroup
	rows := make(chan int, H)
	for y := 0; y < H; y++ {
		rows <- y
	}
	close(rows)
	for k := 0; k < workers; k++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for y := range rows {
				for x := 0; x < W; x++ {
					r.img[y*W+x] = r.shade(s, float64(x)+0.5, float64(y)+0.5, L, Hh)
				}
			}
		}()
	}
	wg.Wait()
	// Spray: particles outside the liquid surface become droplets.
	for i := range s.px {
		cx, cy := s.px[i]*PXM, (s.hd-s.py[i])*PXM
		if r.field(r.dens, cx, cy) > r.T*0.85 {
			continue
		}
		sx, sy := r.toScreen(cx, cy)
		c := mix(cCyan, cCoral, s.dye[i]).add(rgb{0.15, 0.15, 0.15})
		r.disc(sx, sy, 1.5, c, 0.75)
	}
}

// shade colors one screen pixel: backdrop, end caps and pillars, liquid, then the glass.
func (r *Ren) shade(s *Sim, fx, fy float64, L, Hh [3]float64) rgb {
	col := r.bg(fx, fy)
	cx, cy := r.toCanvas(fx, fy)
	xt, yt := cx/PXM-s.wd/2, s.hd/2-cy/PXM
	ax, ay := math.Abs(xt), math.Abs(yt)
	px := 1 / PXM
	// End caps: lit as rounded slabs.
	if ay > hgB+wallT*0.5 && ay < hgB+0.085 && ax < hgA+0.11 {
		e := math.Min(math.Min(ay-(hgB+wallT*0.5), hgB+0.085-ay), hgA+0.11-ax)
		cov := clampf(e/px+0.5, 0, 1)
		v := clampf((ay-(hgB+0.05))/0.035, -1, 1)
		nx, ny := r.vecToScreen(0, -math.Copysign(v, yt))
		nz := math.Sqrt(math.Max(0, 1-v*v))
		dl := math.Max(nx*L[0]+ny*L[1]+nz*L[2], 0)
		c := cCoral.mul(0.35 + 0.75*dl)
		sp := math.Pow(math.Max(nx*Hh[0]+ny*Hh[1]+nz*Hh[2], 0), 40) * 0.6
		return mix(col, c.add(rgb{sp, sp, sp}), cov)
	}
	// Pillars: thin cream rods.
	if ax > hgA+0.05 && ax < hgA+0.08 && ay <= hgB+0.06 {
		e := math.Min(ax-(hgA+0.05), hgA+0.08-ax)
		u := clampf((ax-(hgA+0.065))/0.015, -1, 1)
		nx, ny := r.vecToScreen(math.Copysign(u, xt), 0)
		nz := math.Sqrt(math.Max(0, 1-u*u))
		dl := math.Max(nx*L[0]+ny*L[1]+nz*L[2], 0)
		col = mix(col, cCream.mul(0.4+0.6*dl), clampf(e/px+0.5, 0, 1))
	}
	sd := hgSDF(xt, yt)
	if sd > wallT {
		return col
	}
	if sd < 0 {
		if a := smooth((r.field(r.aer, cx, cy)/r.F0-0.5)/0.2) * 0.6; a > 0 {
			froth := mix(cCyan, cCoral, smooth((r.field(r.mixq, cx, cy)-0.5)*2.4+0.5))
			col = mix(col, mix(froth.mul(0.7), cCream, 0.18), a)
		}
		f := r.field(r.dens, cx, cy)
		if f > r.T*0.5 {
			gx, gy := r.field(r.gx, cx, cy)/2, r.field(r.gy, cx, cy)/2
			gl := math.Hypot(gx, gy) + 1e-4
			sdl := (f - r.T) / gl
			alpha := clampf(sdl+0.5, 0, 1)
			if alpha > 0 {
				dd := clampf(sdl/14, 0, 1)
				edge := (1 - dd) * (1 - dd)
				nx, ny := r.vecToScreen(-gx/gl, -gy/gl)
				N := norm3(nx*edge*1.7, ny*edge*1.7, 1)
				depth := r.field(r.dist, cx, cy) * 2
				dye := r.field(r.mixq, cx, cy)
				base := mix(cCyan, cCoral, smooth((dye-0.5)*2.4+0.5))
				body := mix(base, mix(base, cNavy, 0.75), smooth(depth/170))
				lc := body.mul(0.78 + 0.32*(N[0]*L[0]+N[1]*L[1]+N[2]*L[2]))
				spec := math.Pow(math.Max(N[0]*Hh[0]+N[1]*Hh[1]+N[2]*Hh[2], 0), 70) * 0.8
				rim := math.Pow(1-dd, 7) * 0.5
				lc = lc.add(rgb{spec + rim*0.7, spec + rim*0.85, spec + rim*0.9})
				col = mix(col, lc, alpha)
			}
		}
	}
	// Glass: faint body, a curved highlight that follows the light as the glass turns, and the wall.
	w, _ := hgWidth(yt)
	u := clampf(xt/w, -1, 1)
	gnx, gny := r.vecToScreen(u, 0)
	gnz := math.Sqrt(math.Max(0, 1-u*u))
	gsp := math.Pow(math.Max(gnx*Hh[0]+gny*Hh[1]+gnz*Hh[2], 0), 28)
	if sd < 0 {
		col = col.add(cCream.mul(0.02 + 0.14*gsp + 0.05*math.Pow(1-gnz, 3)))
	}
	if sd > -px {
		cov := clampf(math.Min(sd+px, wallT-sd)/px+0.5, 0, 1)
		col = mix(col, cCream.mul(0.42+0.5*gsp), cov*0.75)
	}
	return col
}

// blurBox runs a separable box blur of radius k in place (tmp is scratch space of the same size).
func blurBox(a, tmp []float64, w, h, k int) {
	inv := 1 / float64(2*k+1)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			s := 0.0
			for d := -k; d <= k; d++ {
				s += a[y*w+clampi(x+d, 0, w-1)]
			}
			tmp[y*w+x] = s * inv
		}
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			s := 0.0
			for d := -k; d <= k; d++ {
				s += tmp[clampi(y+d, 0, h-1)*w+x]
			}
			a[y*w+x] = s * inv
		}
	}
}

// chamfer turns a 0 / 1e9 mask into the distance (in cells) to the nearest zero, in two passes.
func chamfer(d []float64, w, h int) {
	const dg = math.Sqrt2
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := y*w + x
			v := d[i]
			if x > 0 {
				v = math.Min(v, d[i-1]+1)
			}
			if y > 0 {
				v = math.Min(v, d[i-w]+1)
				if x > 0 {
					v = math.Min(v, d[i-w-1]+dg)
				}
				if x < w-1 {
					v = math.Min(v, d[i-w+1]+dg)
				}
			}
			d[i] = v
		}
	}
	for y := h - 1; y >= 0; y-- {
		for x := w - 1; x >= 0; x-- {
			i := y*w + x
			v := d[i]
			if x < w-1 {
				v = math.Min(v, d[i+1]+1)
			}
			if y < h-1 {
				v = math.Min(v, d[i+w]+1)
				if x < w-1 {
					v = math.Min(v, d[i+w+1]+dg)
				}
				if x > 0 {
					v = math.Min(v, d[i+w-1]+dg)
				}
			}
			d[i] = math.Min(v, 400)
		}
	}
}

func (r *Ren) disc(cx, cy, rad float64, c rgb, a float64) {
	for y := int(cy - rad - 1); y <= int(cy+rad+1); y++ {
		for x := int(cx - rad - 1); x <= int(cx+rad+1); x++ {
			if x < 0 || y < 0 || x >= W || y >= H {
				continue
			}
			d := math.Hypot(float64(x)+0.5-cx, float64(y)+0.5-cy)
			if cov := clampf(rad-d+0.5, 0, 1); cov > 0 {
				i := y*W + x
				r.img[i] = mix(r.img[i], c, cov*a)
			}
		}
	}
}

func norm3(x, y, z float64) [3]float64 {
	l := math.Sqrt(x*x + y*y + z*z)
	return [3]float64{x / l, y / l, z / l}
}

// write stores the frame as binary PPM with light dithering.
func (r *Ren) write(path string, seed uint32) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	fmt.Fprintf(w, "P6\n%d %d\n255\n", W, H)
	st := seed*2654435761 + 1
	for _, c := range r.img {
		for _, ch := range [3]float64{c.r, c.g, c.b} {
			st ^= st << 13
			st ^= st >> 17
			st ^= st << 5
			v := clampf(ch, 0, 1)*255 + float64(st%1000)/1000 - 0.5
			w.WriteByte(byte(clampf(math.Round(v), 0, 255)))
		}
	}
	return w.Flush()
}

func main() {
	out := "frames"
	frames, workers := 240, 8
	if len(os.Args) > 1 {
		out = os.Args[1]
	}
	if len(os.Args) > 2 {
		frames, _ = strconv.Atoi(os.Args[2])
	}
	if len(os.Args) > 3 {
		workers, _ = strconv.Atoi(os.Args[3])
	}
	if err := os.MkdirAll(out, 0o755); err != nil {
		panic(err)
	}
	sim := newSim(0.008)
	ren := newRen(sim)
	fmt.Printf("grid %dx%d, %d particles\n", sim.nx, sim.ny, len(sim.px))
	const fps, sub = 30.0, 5
	dt := 1 / (fps * sub)
	t := 0.0
	t0 := time.Now()
	for f := 0; f < frames; f++ {
		if f > 0 {
			for k := 0; k < sub; k++ {
				sim.step(t, dt)
				t += dt
			}
		}
		ren.draw(sim, t, workers)
		if err := ren.write(fmt.Sprintf("%s/f_%04d.ppm", out, f), uint32(f)); err != nil {
			panic(err)
		}
		if f%30 == 0 {
			fmt.Printf("frame %d t=%.2fs elapsed %.1fs\n", f, t, time.Since(t0).Seconds())
		}
	}
	fmt.Printf("done %.1fs\n", time.Since(t0).Seconds())
}
