"use client";

type Attempt = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Problem = {
  id: string;
  question_content: string;
  created_at: string;
  exam_attempts?: Attempt[];
};

export default function ExamProblemSidebar({
  problems,
  selectedProblemId,
  onSelectProblem,
}: {
  problems: Problem[];
  selectedProblemId: string | null;
  onSelectProblem: (id: string) => void;
}) {
  if (!problems || problems.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500 text-center">
        問題がありません
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 p-2">
      <div className="text-xs font-bold text-slate-400 px-2 mb-1">
        試験問題一覧
      </div>
      {problems.map((problem, index) => {
        const attempts = problem.exam_attempts || [];
        const lastAssistantAttempt = [...attempts]
          .reverse()
          .find((a) => a.role === "assistant");
        const isPassed =
          lastAssistantAttempt?.content?.includes("合格") || false;

        return (
          <button
            key={problem.id}
            onClick={() => onSelectProblem(problem.id)}
            className={`w-full text-left p-3 rounded-lg transition-all border text-sm flex items-center justify-between ${
              problem.id === selectedProblemId
                ? "bg-blue-600/20 border-blue-500/50 text-white shadow-sm"
                : "bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                #{index + 1}
              </span>
              {/* <span className="truncate text-xs">
                {problem.question_content.slice(0, 22)}...
              </span> */}
            </div>

            <div>
              {isPassed ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  合格
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                  挑戦中
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
