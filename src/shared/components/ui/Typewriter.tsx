/**
 * @file Typewriter.tsx
 * 
 * @description
 * Role: 타이핑 애니메이션 효과를 제공하는 텍스트 컴포넌트
 * 
 * Responsibilities:
 * - 텍스트를 한 글자씩 순차적으로 표시하는 타이핑 효과
 * - 커스터마이징 가능한 타이핑 속도
 * - 타이핑 완료 시 콜백 실행
 * 
 * Key Dependencies:
 * - React useState/useEffect/useRef: 상태 및 타이머 관리
 */

import { useState, useEffect, useRef } from 'react';

/** Typewriter 컴포넌트의 props 인터페이스 */
interface TypewriterProps {
    /** 표시할 전체 텍스트 */
    text: string;
    /** 글자당 타이핑 속도 (ms, 기본값: 30) */
    speed?: number;
    /** 타이핑 완료 시 콜백 */
    onComplete?: () => void;
    /** 추가 CSS 클래스 */
    className?: string;
}

/**
 * 타이핑 애니메이션 효과 컴포넌트
 * 
 * 주어진 텍스트를 한 글자씩 순차적으로 표시하여 타이핑 효과를 연출한다.
 * 텍스트가 변경되면 처음부터 다시 타이핑을 시작한다.
 * 
 * @param props - Typewriter 컴포넌트 props
 * @param props.text - 표시할 전체 텍스트
 * @param props.speed - 글자당 타이핑 속도 (ms, 기본값: 30)
 * @param props.onComplete - 타이핑 완료 시 콜백
 * @param props.className - 추가 CSS 클래스
 * @returns 타이핑 애니메이션 텍스트 React 엘리먼트
 */
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
