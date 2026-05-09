import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const scans = await prisma.scanDraft.findMany({
    where: { processed: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(scans);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.isbn) {
    return NextResponse.json({ error: "ISBN requerido" }, { status: 400 });
  }

  const scan = await prisma.scanDraft.create({
    data: {
      isbn: body.isbn,
      title: body.title || null,
      author: body.author || null,
      publisher: body.publisher || null,
      coverUrl: body.coverUrl || null,
    },
  });
  return NextResponse.json(scan, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "Id requerido" }, { status: 400 });
  }

  await prisma.scanDraft.update({
    where: { id: Number(body.id) },
    data: { processed: true },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await prisma.scanDraft.deleteMany({});
  return NextResponse.json({ ok: true });
}
