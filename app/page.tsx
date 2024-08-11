'use client'
import { useState, useEffect, useRef, createElement } from "react";
import { PromptForm } from "@/components/PromptForm";
import { IconUser } from '@/components/ui/icons'
import Image from "next/image";
import { cn } from '@/lib/utils'
import { EmptyScreen } from "../components/EmptyPage"
import MarcusFace from "../public/marcus-face.png"
import { IconSpinner } from "@/components/ui/icons";


const FormattedText = ({ text }: any) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/);

  return (
    <>
      {parts.map((part: any, index: number) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        } else {
          return part;
        }
      })}
    </>
  );
};



export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number | null>(null);


  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  const [message, setMessage] = useState('');

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // SEND FUNCTION
  const sendMessage = async (messageToSend: string) => {
    setMessage('');
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: 'assistant', content: '' },
    ]);

    setLoadingMessageIndex(messages.length + 1);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageToSend }),
      });

      setLoadingMessageIndex(null);


      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      // Decode resposne
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          const chunk = decoder.decode(value, { stream: !done });
          if (chunk) {
            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              const updatedLastMessage = {
                ...lastMessage,
                content: lastMessage.content + chunk,
              };
              return [...prevMessages.slice(0, -1), updatedLastMessage];
            });
          }
        }
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setLoadingMessageIndex(null);

    }
  };



  return (
    <>
      {/* Main chat */}
      <div className='min-h-screen flex flex-col items-center pt-14 pb-3'>
        <div ref={messagesContainerRef}
          className='w-full max-w-screen-xs sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg xl:max-w-screen-xl 2xl:max-w-screen-xl mg-white p-2 rounded-lg max-h-[650px] md:max-h-[700px] lg:max-h-[750px] overflow-y-auto hide-scrollbar'>

          {messages.length === 0 ?
            <EmptyScreen
              messages={messages}
              input={message}
              setMessage={setMessage}
              onSubmit={async (value: string) => {
                setMessage('');
                setMessages(prevMessages => [
                  ...prevMessages,
                  { role: 'user', content: value },
                ]);
                await sendMessage(value);
              }}
            /> :
            <div className="relative mx-auto max-w-3xl grid auto-rows-max gap-8 px-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className="text-left flex"
                >
                  <div
                    className={cn(
                      'flex size-7 shrink-0 select-none items-center justify-center rounded-lg border shadow',
                    )}
                  >
                    {message.role === 'user' ? <IconUser /> : <Image src={MarcusFace} width={50} height={50} alt="gemini icon" />}
                  </div>
                  <div
                    className="px-5 self-center"
                  >

                    {index === loadingMessageIndex ? (
                      <IconSpinner />
                    ) : (
                      <FormattedText text={message.content} />
                    )}
                  </div>

                </div>
              ))}
            </div>
          }
        </div>

        {/* Input bar */}
        <div className="sticky top-full sm:w-[640px]">
          <PromptForm
            input={message}
            setInput={setMessage}
            onSubmit={async (value: string) => {
              setMessage('');
              setMessages(prevMessages => [
                ...prevMessages,
                { role: 'user', content: value },
              ]);
              await sendMessage(value);
            }}
          />
          <span className="mt-2 block text-sm text-gray-500 text-center dark:text-gray-400">© 2023. All Rights Reserved.</span>

        </div>
      </div>
    </>
  );

}
