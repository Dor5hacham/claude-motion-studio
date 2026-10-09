/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Declarations for the TypeScript check of the site scripts (command in site/README.md, "Check
// before committing"). The page never loads this file. It only tells the checker about the
// globals that the classic scripts share through window.
declare var EX: any;
interface Window {
  EX: any;
  CLIPS: any[];
  FX_SOURCE: string;
  MG_titleScene: any;
}
