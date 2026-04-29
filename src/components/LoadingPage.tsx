interface LoadingPageProps {
  loadingText?: string;
}

export default function LoadingPage({ loadingText = "Loading..." }: LoadingPageProps) {
  return (
    <div className="bg-white text-black h-screen w-screen text-xl flex justify-center items-center">
      {loadingText}
    </div>
  );
}
