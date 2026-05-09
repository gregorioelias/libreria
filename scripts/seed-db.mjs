import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const samples = [
  {
    isbn: "9789871111001",
    title: "La ciudad de papel",
    author: "Lucia Ferrer",
    publisher: "Sur Editorial",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9789871111001-M.jpg",
    location: "Deposito A / Estante 3",
    stock: 7,
    notes: "Rotacion alta",
    price: 18990,
  },
  {
    isbn: "9789500202020",
    title: "Historias del Puerto",
    author: "Martin Quiroga",
    publisher: "Rio de la Plata",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9789500202020-M.jpg",
    location: "Mesa novedades",
    stock: 3,
    notes: "Exhibicion principal",
    price: 15600,
  },
  {
    isbn: "9788412345005",
    title: "Manual practico de librerias",
    author: "Sofia Campos",
    publisher: "Oficio Ediciones",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9788412345005-M.jpg",
    location: "Caja atras",
    stock: 0,
    notes: "Solicitar reposicion",
    price: 21200,
  },
];

async function seed() {
  await prisma.scanDraft.deleteMany({});
  for (const item of samples) {
    await prisma.book.upsert({
      where: { isbn: item.isbn },
      create: item,
      update: item,
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completado.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
