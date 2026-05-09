import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Id invalido" }, { status: 400 });
  }

  await prisma.scanDraft.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
