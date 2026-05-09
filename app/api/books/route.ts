import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const books = await prisma.book.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { author: { contains: query, mode: "insensitive" } },
            { isbn: { contains: query, mode: "insensitive" } },
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Id requerido" }, { status: 400 });
    }
    const updated = await prisma.book.update({
      where: { id: Number(body.id) },
      data: {
        location: typeof body.location === "string" ? body.location : undefined,
        stock: typeof body.stock === "number" ? body.stock : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        price: typeof body.price === "number" ? body.price : body.price === null ? null : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "No se pudo actualizar", detail: error }, { status: 400 });
  }
}

export async function DELETE() {
  await prisma.book.deleteMany({});
  return NextResponse.json({ ok: true });
}
