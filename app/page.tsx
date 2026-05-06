import LayoutClient from './layout-client';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <LayoutClient>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="max-w-6xl w-full px-4 py-6 sm:py-12 lg:py-24">
            <div className="text-center mb-8 sm:mb-16">
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 text-slate-800 leading-tight">
                Chat with Your Documents
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                Upload your files and ask questions about their content using AI
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 mb-8 sm:mb-16">
              <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800">Supported Features</h2>
                <ul className="space-y-2 sm:space-y-3 text-slate-600 text-sm sm:text-base">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Upload and process <strong>PDF</strong>, <strong>PowerPoint</strong>, <strong>Markdown</strong>, and <strong>Text</strong> files</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Automatic document processing with AI embeddings</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Chat with AI about specific documents</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>View conversation history for each document</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Generate flashcards, quizzes, and summaries</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Track study progress with analytics</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800">Get Started</h2>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-start">
                    <div className="bg-blue-500 text-white rounded-full h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center mr-3 flex-shrink-0 text-sm sm:text-base font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">Upload your documents</h3>
                      <p className="text-slate-600 text-sm sm:text-base">Upload PDF, PowerPoint, Markdown or Text files to the system</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-blue-500 text-white rounded-full h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center mr-3 flex-shrink-0 text-sm sm:text-base font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">Wait for processing</h3>
                      <p className="text-slate-600 text-sm sm:text-base">The system will automatically extract and analyze the content</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-blue-500 text-white rounded-full h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center mr-3 flex-shrink-0 text-sm sm:text-base font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">Chat and study</h3>
                      <p className="text-slate-600 text-sm sm:text-base">Ask questions, review flashcards, take quizzes, and track your progress</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md mx-auto sm:max-w-none">
              <Link 
                href="/files" 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 rounded-md text-base sm:text-lg font-medium text-center transition-colors"
              >
                📁 Upload Files
              </Link>
              <Link 
                href="/chat?new=true" 
                className="w-full sm:w-auto bg-slate-700 hover:bg-slate-800 text-white px-6 sm:px-8 py-3 rounded-md text-base sm:text-lg font-medium text-center transition-colors"
              >
                💬 Start Chatting
              </Link>
            </div>

            {/* Quick Actions for Mobile */}
            <div className="mt-8 sm:hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link 
                  href="/analytics" 
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 p-3 rounded-lg text-center text-sm font-medium transition-colors"
                >
                  📊 Analytics
                </Link>
                <Link 
                  href="/study" 
                  className="bg-green-100 hover:bg-green-200 text-green-800 p-3 rounded-lg text-center text-sm font-medium transition-colors"
                >
                  📚 Study Mode
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayoutClient>
  );
}
