export default function NoEncontrado() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-bold">No disponible</h1>
      <p className="text-neutral-600">
        Esta tienda o este producto no existen, o el catálogo todavía no se ha publicado.
      </p>
    </main>
  );
}
