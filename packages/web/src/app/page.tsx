import { TaskForm } from "@/components/TaskForm";

export default function Home() {
  return (
    <div className="flex flex-col items-center pt-16 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Magi</h1>
        <p className="text-text-dim">
          3人の賢者が議論し、成果物を生み出す
        </p>
      </div>
      <TaskForm />
    </div>
  );
}
