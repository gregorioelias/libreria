import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [totalBooks, withoutStock, latestBooks] = await Promise.all([
    prisma.book.count(),
    prisma.book.count({ where: { stock: { lte: 0 } } }),
    prisma.book.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, author: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ totalBooks, withoutStock, latestBooks });
}
