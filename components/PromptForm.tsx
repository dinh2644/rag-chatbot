'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'
import { Button } from '@/components/ui/button'
import { IconArrowElbow, IconRefresh } from '@/components/ui/icons'
import { useEnterSubmit } from '../app/hook/useEnterSubmit'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from '@/components/ui/tooltip'


export function PromptForm({
    input,
    setInput,
    onSubmit
}: {
    input: string
    setInput: (value: string) => void
    onSubmit: (value: string) => Promise<void>

}) {
    const { formRef, onKeyDown } = useEnterSubmit()
    const inputRef = React.useRef<HTMLTextAreaElement>(null)

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }, [])

    const handleRefresh = () => {
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    return (
        <TooltipProvider>
            <form
                ref={formRef}
                onSubmit={async (e: any) => {
                    e.preventDefault()

                    // Blur focus on mobile
                    if (window.innerWidth < 600) {
                        e.target['message']?.blur()
                    }

                    const value = input.trim()
                    setInput('')
                    if (!value) return

                    await onSubmit(value)
                }}
            >
                <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-zinc-100 px-12 sm:rounded-full sm:px-12">
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-4 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
                        type='button'
                        onClick={handleRefresh}
                    >
                        <IconRefresh />
                    </Button>
                    <Textarea
                        ref={inputRef}
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        placeholder="Send a message."
                        className="min-h-[60px] w-full bg-transparent placeholder:text-zinc-900 resize-none px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        name="message"
                        rows={1}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <div className="absolute right-4 top-[13px] sm:right-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={input === ''}
                                    className="bg-transparent shadow-none text-zinc-950 rounded-full hover:bg-zinc-200"
                                >
                                    <IconArrowElbow />
                                    <span className="sr-only">Send message</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send message</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </form>
        </TooltipProvider>
    )
}