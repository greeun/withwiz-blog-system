import type { NextRequest } from 'next/server';

export type NextMiddleware = (req: NextRequest) => Promise<Response | void>;
