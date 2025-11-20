import { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
    text: string;
    speed?: number;
    onComplete?: () => void;
    className?: string;
}

export function Typewriter({ text, speed = 30, onComplete, className = '' }: TypewriterProps) {
    const [displayLength, setDisplayLength] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Reset when text changes
    useEffect(() => {
        setDisplayLength(0);

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            setDisplayLength((prev) => {
                if (prev < text.length) {
                    return prev + 1;
                } else {
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                    }
                    if (onComplete) {
                        onComplete();
                    }
                    return prev;
                }
            });
        }, speed);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [text, speed, onComplete]);

    return (
        <span className={className}>
            {text.slice(0, displayLength)}
            <span style={{ opacity: 0 }}>{text.slice(displayLength)}</span>
        </span>
    );
}
