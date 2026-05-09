import { NextRequest, NextResponse } from "next/server";

function normalizeOpenLibrary(data: Record<string, unknown>, isbn: string) {
  const key = `ISBN:${isbn}`;
  const entry = data[key] as
    | {
        title?: string;
        authors?: { name: string }[];
        publishers?: { name: string }[];
        cover?: { medium?: string; large?: string };
      }
    | undefined;
  if (!entry) return null;
  return {
    title: entry.title ?? "",
    author: entry.authors?.map((author) => author.name).join(", ") ?? "",
    publisher: entry.publishers?.map((publisher) => publisher.name).join(", ") ?? "",
    coverUrl: entry.cover?.large || entry.cover?.medium || null,
  };
}

export async function GET(request: NextRequest) {
  const isbn = request.nextUrl.searchParams.get("isbn")?.replaceAll("-", "").trim();
  if (!isbn) {
    return NextResponse.json({ error: "ISBN requerido" }, { status: 400 });
  }

  const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const openLibraryResponse = await fetch(openLibraryUrl, { cache: "no-store" });
  if (openLibraryResponse.ok) {
    const data = (await openLibraryResponse.json()) as Record<string, unknown>;
    const normalized = normalizeOpenLibrary(data, isbn);
    if (normalized) return NextResponse.json(normalized);
  }

  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  const googleResponse = await fetch(googleUrl, { cache: "no-store" });
  if (!googleResponse.ok) {
    return NextResponse.json({ error: "No se pudo consultar metadata" }, { status: 502 });
  }
  const googleData = await googleResponse.json();
  const volume = googleData.items?.[0]?.volumeInfo;
  if (!volume) {
    return NextResponse.json({ error: "ISBN no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    title: volume.title ?? "",
    author: Array.isArray(volume.authors) ? volume.authors.join(", ") : "",
    publisher: volume.publisher ?? "",
    coverUrl: volume.imageLinks?.thumbnail ?? null,
  });
}
