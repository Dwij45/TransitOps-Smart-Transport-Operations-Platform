import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export const GET = async (req: Request) => {
  console.log(`[AUTH GET] ${req.url}`);
  return handlers.GET(req);
};

export const POST = async (req: Request) => {
  console.log(`[AUTH POST] ${req.url}`);
  return handlers.POST(req);
};
