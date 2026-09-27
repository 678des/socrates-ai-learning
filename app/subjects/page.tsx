import NewSubjectModal from "./_components/NewSubjectModal";
import SubjectTitleArea from "./_components/SubjectsTitleArea";

export default async function DashboardHomePage() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#E7E8EA]">
          今日は何を学びますか？
        </h1>
        <p className="mt-1.5 text-sm text-[#98A0AC]">
          教科を選んで続きから始めるか、新しい学習をはじめましょう。
        </p>
      </div>

      <NewSubjectModal />
      <SubjectTitleArea />
    </div>
  );
}
