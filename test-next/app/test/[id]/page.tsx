export default function Page({ params }: { params: { id: string } }) {
    return <div>ID: {params.id}</div>
  }