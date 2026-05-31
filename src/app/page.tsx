import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-black text-white">Quiz App</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/join"
          className="block text-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-lg"
        >
          Rejoindre un quiz
        </Link>
        <Link
          href="/admin"
          className="block text-center bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-2xl"
        >
          Espace admin
        </Link>
      </div>
    </div>
  );
}
