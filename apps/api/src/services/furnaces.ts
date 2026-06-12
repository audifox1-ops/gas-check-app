import { prisma } from "../db";
import { HttpError } from "../http";

export async function resolveFurnace(input: { furnaceId?: string | null; furnaceNo?: number | null }) {
  if (input.furnaceId) {
    const furnace = await prisma.furnace.findUnique({ where: { id: input.furnaceId } });
    if (!furnace) throw new HttpError(400, "Unknown furnaceId");
    return furnace;
  }
  if (input.furnaceNo !== null && input.furnaceNo !== undefined) {
    const furnace = await prisma.furnace.findUnique({ where: { no: input.furnaceNo } });
    if (!furnace) throw new HttpError(400, "Unknown furnaceNo");
    return furnace;
  }
  throw new HttpError(400, "furnaceId 또는 furnaceNo가 필요합니다.");
}
