import { ExternalLink } from '@/components/external-link'
import { ChatPanel } from './ChatPanel'
import MarcusFace from "../public/marcus-face.png"
import Image from 'next/image'

interface EmptyScreenProps {
    messages: Array<{ role: string; content: string }>;
    input: string;
    setMessage: (value: string) => void;
    onSubmit: (value: string) => Promise<void>;
}

export function EmptyScreen({
    messages,
    input,
    setMessage,
    onSubmit,
}: EmptyScreenProps) {
    return (
        <>
            <div className="mx-auto max-w-2xl px-4">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-zinc-50 sm:p-8 p-4 text-sm sm:text-base">
                    <h1 className="text-2xl sm:text-3xl tracking-tight font-semibold max-w-fit inline-block mb-2">
                        <Image src={MarcusFace} width={150} height={150} alt='aurelius face' />
                    </h1>
                    <span className='text-sm italic'>"Emperor, 161–180 A.D."</span>
                    <p className="leading-normal text-zinc-900">
                        Chat with Marcus Aurelius, a man who lived humbly while ruling for 20 years.
                        Discover the private thoughts of a Roman Emperor who desired nothing.
                        Dive into the mind of Caesar—and learn more about <ExternalLink href="https://www.gutenberg.org/files/55317/55317-h/55317-h.htm">
                            <i>"The Meditations".</i>
                        </ExternalLink>


                    </p>
                </div>
            </div>

            <ChatPanel
                messages={messages}
                input={input}
                setMessage={setMessage}
                onSubmit={onSubmit}
            />
        </>
    )
}