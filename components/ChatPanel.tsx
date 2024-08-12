import * as React from 'react'
import { cn } from '@/lib/utils'
import { IconUser } from '@/components/ui/icons'
import Image from "next/image";
import IconGemini from "../public/gemini.png"

export interface ChatPanelProps {
    messages: Array<{ role: string; content: string }>;
    input: string;
    setMessage: (value: string) => void;
    onSubmit: (value: string) => Promise<void>;
}

export function ChatPanel({
    messages,
    input,
    setMessage,
    onSubmit,
}: ChatPanelProps) {

    const exampleMessages = [
        {
            heading: 'What do you tell youself...',
            subheading: 'when you wake up each morning?',
            message: `What do you tell yourself when you wake up each morning?`
        },
        {
            heading: 'Interpret the quote...',
            subheading: "from book 4, verse 42",
            message: "Interpret the quote from book 4, verse 42 about change."
        }
    ]

    return (
        <div className="inset-x-0 bg-white/90 bottom-0 w-full duration-300 ease-in-out peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px] dark:from-10%">
            <div className="mx-auto sm:max-w-2xl sm:px-4">
                <div className='overflow-auto h-[50px] sm:h-[270px]'>
                    {messages.length > 1 && messages.map((message, index) => (
                        <div
                            key={index}
                            className={`${message.role === 'user' ? 'text-left' : 'text-right'} mb-2`}
                        >
                            <div className={cn(
                                'flex size-8 shrink-0 select-none items-center justify-center rounded-lg border shadow',
                            )}>
                                {message.role === 'user' ? <IconUser /> : <Image src={IconGemini} width={50} height={50} alt="gemini icon" />}
                            </div>
                            <div>
                                {message.content}
                            </div>
                        </div>
                    ))}
                </div>


                <div className="grid sm:grid-cols-2 gap-2 sm:gap-4 px-4 sm:px-0">
                    {exampleMessages.map((example, index) => (
                        <div
                            key={example.heading}
                            className={cn(
                                'cursor-pointer bg-zinc-50 text-zinc-950 rounded-2xl p-4 sm:p-6 hover:bg-zinc-100 transition-colors',
                                index > 1 && 'hidden md:block'
                            )}
                            onClick={() => {
                                setMessage(example.message);
                                onSubmit(example.message);

                            }}
                        >
                            <div className="font-medium">{example.heading}</div>
                            <div className="text-sm text-zinc-800">
                                {example.subheading}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}