import LayoutClient from './layout-client';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <LayoutClient>
      <div className="flex flex-col items-center">
        <div className="max-w-6xl w-full px-4 py-12 sm:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6 text-slate-800">
              Chat with Your Documents
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 max-w-3xl mx-auto">
              Upload your files and ask questions about their content using AI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-4 text-slate-800">Supported Features</h2>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Upload and process <strong>PDF</strong>, <strong>PowerPoint</strong>, <strong>Markdown</strong>, and <strong>Text</strong> files</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Automatic document processing with AI embeddings</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Chat with AI about specific documents</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>View conversation history for each document</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>See source citations for AI responses</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-4 text-slate-800">Get Started</h2>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold">Upload your documents</h3>
                    <p className="text-slate-600">Upload PDF, PowerPoint, Markdown or Text files to the system</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold">Wait for processing</h3>
                    <p className="text-slate-600">The system will automatically extract and analyze the content</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold">Chat with your documents</h3>
                    <p className="text-slate-600">Ask questions and get answers based on your document content</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/files" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md text-lg font-medium"
            >
              Upload Files
            </Link>
            <Link 
              href="/chat?new=true" 
              className="bg-slate-700 hover:bg-slate-800 text-white px-8 py-3 rounded-md text-lg font-medium"
            >
              Start Chatting
            </Link>
          </div>
        </div>
      </div>
    </LayoutClient>
  );
}
