/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

import React from 'react';
import { Composition } from 'remotion';
import { StatReel } from './StatReel';

export const RemotionRoot: React.FC = () => (
  <Composition id="StatReel" component={StatReel} durationInFrames={225} fps={30} width={1280} height={720} />
);
