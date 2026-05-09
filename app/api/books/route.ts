import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const books = await prisma.book.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { isbn: { contains: query } },
          ],
        }
      : undefined,
    orderBy: [{ stock: "desc" }, { title: "asc" }],
    take: 40,
  });
  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const book = await prisma.book.upsert({
      where: { isbn: body.isbn },
      create: {
        isbn: body.isbn,
        title: body.title,
        author: body.author,
        publisher: body.publisher || null,
        coverUrl: body.coverUrl || null,
        location: body.location,
        stock: Number(body.stock) || 0,
        notes: body.notes || null,
        price: body.price ? Number(body.price) : null,
      },
      update: {
        title: body.title,
        author: body.author,
        publisher: body.publisher || null,
        coverUrl: body.coverUrl || null,
        location: body.location,
        stock: Number(body.stock) || 0,
        notes: body.notes || null,
        price: body.price ? Number(body.price) : null,
      },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo guardar el libro", detail: error }, { status: 400 });
  }
}

export async function DELETE() {
  await prisma.book.deleteMany({});
  return NextResponse.json({ ok: true });
}
