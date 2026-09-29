"use client";

import { useEffect, useState } from "react";
import ChatFrom from "./ChatForm";

import { SendMessage } from "../actions/chat";
import { Inter, Lora } from "next/font/google";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatLogs from "./ChatLogArea";
import { Subject } from "@/lib/types";
import AIReplyButton from "./AIReplyButton";
import StudyNoteArea from "./StudyNoteArea";
import AISummary from "./AISummaryArea";
export type ModeType = "study" | "review";
import { PracticeExam } from "../actions/practice";
import ExamProblemSidebar from "./ExamProblemList";
import ExamProblemDetail from "./ExamChat";
import { Exam } from "../actions/exam";
import { User } from "@supabase/supabase-js";

import type { Message, ExamProblem } from "../../../../../lib/types";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});
export const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function SubjectDetailClient({
  subjects,
  subjectName,
  subjectId,
  studyChatlogs,
  problems,
  user,
  aiSummary,
  studyNote,
}: {
  subjects: Subject[];
  subjectName: string;
  subjectId: string;
  studyChatlogs: Message[];
  problems: ExamProblem[];
  user: User;
  aiSummary: string;
  studyNote: string;
}) {
  const [activeMode, setActiveMode] = useState<ModeType>(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("activeMode") as ModeType;
      if (savedMode) return savedMode;
    }
    return "study"; // デフォルト値
  });

  // activeMode が変更されたら localStorage に保存
  useEffect(() => {
    localStorage.setItem("activeMode", activeMode);
  }, [activeMode]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isStudyMemoOpen, setIsStudyMemoOpen] = useState(false);
  const [normalChatLogs, setNormalChatLogs] = useState<Message[]>(
    studyChatlogs || [],
  );
  const [examProblems, setExamProblems] = useState<ExamProblem[]>(problems);
  // const examProblems = problems;
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    problems[1]?.id || "",
  );

  //const [summary, setSummary] = useState<string>(aiSummary);

  console.log(aiSummary);

  const selectedProblem =
    examProblems.find((p) => p.id === selectedProblemId) || null;

  async function execPractice() {
    setActiveMode("review");
    //TODO

    const res = await PracticeExam(subjectId);
    const newProblem = {
      id: crypto.randomUUID(),
      room_id: "",
      question_content: res.aiResponceObj.content,
      created_at: "",
      exam_attempts: [],
    };

    setExamProblems((prev) => [...prev, newProblem]);
    setSelectedProblemId(newProblem.id);
  }
  async function handleSend(message: string) {
    setNormalChatLogs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        created_at: "",
      },
    ]);
    const res = await SendMessage(subjectId, message, activeMode);
    setNormalChatLogs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res?.aiResponceObj.content || "",
        created_at: "",
      },
    ]);
  }

  async function handleAnswer(message: string) {
    const newAttempt = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: message,
      created_at: "",
    };

    setExamProblems((prevProblems) =>
      prevProblems.map((problem) => {
        if (problem.id === selectedProblemId) {
          return {
            ...problem,
            // null/undefined 対策（オプショナルチェーンまたは空配列のフォールバック）をつけておくとより安全です
            exam_attempts: [...(problem.exam_attempts ?? []), newAttempt],
          };
        }
        return problem;
      }),
    );

    if (!selectedProblemId) return;
    const res = await Exam(message, subjectId, selectedProblemId);

    const newAIAttempt = {
      id: crypto.randomUUID(),
      role: "assistant" as const,
      content: res.aiResponceObj.content,
      created_at: "",
    };

    setExamProblems((prevProblems) =>
      prevProblems.map((problem) => {
        if (problem.id === selectedProblemId) {
          return {
            ...problem,
            // null/undefined 対策（オプショナルチェーンまたは空配列のフォールバック）をつけておくとより安全です
            exam_attempts: [...(problem.exam_attempts ?? []), newAIAttempt],
          };
        }
        return problem;
      }),
    );
  }
  return (
    // ① h-screen で画面全体を固定し、スクロールをアプリ内部に閉じる
    <div
      className={`flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-slate-100 ${inter.className}`}
    >
      {/* ヘッダーエリア */}
      {user && (
        <Header
          user={user}
          chatMode={activeMode}
          onChangeMode={setActiveMode}
          subjectName={subjectName}
          onToggleSidebar={() => setSidebarOpen(true)} // 必要に応じてハンバーガー開閉用関数を渡す
          onToggleStudyMemo={() => setIsStudyMemoOpen((prev) => !prev)}
        />
      )}

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          subjects={subjects}
        />

        {examProblems && activeMode == "review" && (
          <aside className="hidden lg:flex w-60 flex-col gap-6 p-6 border-l border-slate-800 bg-slate-900/40 overflow-y-auto">
            <ExamProblemSidebar
              problems={examProblems}
              selectedProblemId={selectedProblemId}
              onSelectProblem={setSelectedProblemId}
            />
          </aside>
        )}
        {/* {activeMode == "study" &&  (
          <aside className="hidden lg:flex w-80 flex-col gap-6 p-6 border-l border-slate-800 bg-slate-900/40 overflow-y-auto">
            <AISummary initialAISummary={summary || ""} />
          </aside>
        )} */}

        <main className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
          {/* ② チャットログエリア：overflow-y-auto でここだけスクロールさせる */}
          <div className="flex-1 overflow-y-auto min-h-0 mb-4">
            {normalChatLogs && activeMode == "study" && (
              <div>
                <ChatLogs logs={normalChatLogs} />
              </div>
            )}

            {/* 右側：メインエリア（問題の詳細・やり取り・フォーム） */}
            {activeMode == "review" && selectedProblem && (
              <ExamProblemDetail problem={selectedProblem} />
            )}
          </div>
          <div className="shrink-0">
            {activeMode == "study" && <ChatFrom handleSend={handleSend} />}
            {activeMode == "review" && <ChatFrom handleSend={handleAnswer} />}
          </div>
        </main>

        {/* 右側：学習メモ ＆ AI要約パネル */}
        {activeMode == "study" && isStudyMemoOpen && (
          <aside className="w-60 flex-col border-l border-slate-800 bg-slate-900/40 flex shrink-0 overflow-y-auto p-6 space-y-4">
            <div className="space-y-4 text-xs text-slate-300">
              {/* ここにAISummaryや学習メモコンポーネントを配置 */}
              <AISummary initialAISummary={aiSummary || ""} />
              <StudyNoteArea subjectId={subjectId} initialNote={studyNote} />
              <AIReplyButton setReviewMode={execPractice} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
