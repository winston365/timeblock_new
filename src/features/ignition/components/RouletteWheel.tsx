/**
 * RouletteWheel - 원형 룰렛 휠 컴포넌트 (가중치 기반 확률)
 * 
 * @role 작업과 보상을 시각적으로 표시하는 회전 가능한 룰렛 휠
 * @input items: 룰렛 아이템 배열, onSelect: 선택 콜백
 * @output SVG 기반 원형 룰렛 휠 UI
 */

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { ItemRarity } from '@/shared/types/domain';

interface RouletteItem {
    id: string;
    text: string;
    color?: string;
    isTicket?: boolean;
    ticketType?: string;
    resistance?: string;
    weight?: number; // 가중치 (1-100)
    rarity?: ItemRarity; // 희귀도
}

interface RouletteWheelProps {
    items: RouletteItem[];
    onSelect: (item: RouletteItem) => void;
}

export default function RouletteWheel({ items, onSelect }: RouletteWheelProps) {
    const [rotation, setRotation] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const wheelRef = useRef<SVGSVGElement>(null);

    // 아이템별 색상 결정 (희귀도 우선)
    const getItemColor = (item: RouletteItem): string => {
        if (item.color) return item.color;

        // 희귀도별 색상
        if (item.rarity) {
            const rarityColors: Record<ItemRarity, string> = {
                common: '#10b981',    // emerald
                rare: '#3b82f6',      // blue
                epic: '#a855f7',      // purple
                legendary: '#f59e0b', // amber
            };
            return rarityColors[item.rarity];
        }

        if (item.isTicket) {
            return item.ticketType === 'rest_ticket_10' ? '#10b981' : '#3b82f6';
        }

        // 작업 난이도별 색상
        const colors = {
            high: '#8b5cf6',    // purple
            medium: '#6366f1',  // indigo
            low: '#06b6d4',     // cyan
        };

        return colors[item.resistance as keyof typeof colors] || '#6366f1';
    };

    // 가중치 기반 랜덤 선택
    const selectWeightedRandom = (): number => {
        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= (items[i].weight || 1);
            if (random <= 0) {
                return i;
            }
        }

        return items.length - 1;
    };

    // 룰렛 시작
    useEffect(() => {
        if (items.length === 0) return;

        // 자동으로 스핀 시작
        const timer = setTimeout(() => {
            startSpin();
        }, 500);

        return () => clearTimeout(timer);
    }, [items]);

    const startSpin = () => {
        if (isSpinning || items.length === 0) return;

        setIsSpinning(true);

        // 가중치 기반 랜덤 선택
        const randomIndex = selectWeightedRandom();
        setSelectedIndex(randomIndex);

        // 회전 각도 계산
        const degreesPerItem = 360 / items.length;
        const targetDegree = 360 - (randomIndex * degreesPerItem) - (degreesPerItem / 2);
        const spinRotations = 5; // 5바퀴 회전
        const finalRotation = (spinRotations * 360) + targetDegree;

        setRotation(finalRotation);

        // 회전 완료 후 선택 콜백
        setTimeout(() => {
            setIsSpinning(false);

            // 희귀도에 따른 폭죽 효과
            const selectedItem = items[randomIndex];
            const particleCount = selectedItem.rarity === 'legendary' ? 200 :
                selectedItem.rarity === 'epic' ? 150 :
                    selectedItem.rarity === 'rare' ? 100 : 80;

            confetti({
                particleCount,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b'],
            });

            // 레전더리 아이템은 추가 효과
            if (selectedItem.rarity === 'legendary') {
                setTimeout(() => {
                    confetti({
                        particleCount: 100,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                    });
                    confetti({
                        particleCount: 100,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                    });
                }, 250);
            }

            // 선택된 아이템 콜백
            onSelect(items[randomIndex]);
        }, 4000); // 4초 회전
    };

    if (items.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-white/50">
                아이템이 없습니다
            </div>
        );
    }

    const radius = 120;
    const centerX = 150;
    const centerY = 150;
    const degreesPerItem = 360 / items.length;

    return (
        <div className="relative flex flex-col items-center gap-6">
            {/* 상단 포인터 */}
            <div className="relative z-10">
                <div className="h-0 w-0 border-l-[20px] border-r-[20px] border-t-[30px] border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-lg" />
            </div>

            {/* 룰렛 휠 */}
            <div className="relative">
                <motion.svg
                    ref={wheelRef}
                    width="300"
                    height="300"
                    viewBox="0 0 300 300"
                    className="drop-shadow-2xl"
                    animate={{ rotate: rotation }}
                    transition={{
                        duration: 4,
                        ease: [0.25, 0.1, 0.25, 1], // easeOutCubic
                    }}
                >
                    {/* 배경 원 */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={radius + 5}
                        fill="#1a1a1a"
                        stroke="#ffffff"
                        strokeWidth="3"
                    />

                    {/* 섹션들 */}
                    {items.map((item, index) => {
                        const startAngle = (index * degreesPerItem - 90) * (Math.PI / 180);
                        const endAngle = ((index + 1) * degreesPerItem - 90) * (Math.PI / 180);

                        const x1 = centerX + radius * Math.cos(startAngle);
                        const y1 = centerY + radius * Math.sin(startAngle);
                        const x2 = centerX + radius * Math.cos(endAngle);
                        const y2 = centerY + radius * Math.sin(endAngle);

                        const largeArcFlag = degreesPerItem > 180 ? 1 : 0;

                        const pathData = [
                            `M ${centerX} ${centerY}`,
                            `L ${x1} ${y1}`,
                            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                            'Z',
                        ].join(' ');

                        // 텍스트 위치 계산
                        const textAngle = (index * degreesPerItem + degreesPerItem / 2 - 90) * (Math.PI / 180);
                        const textRadius = radius * 0.7;
                        const textX = centerX + textRadius * Math.cos(textAngle);
                        const textY = centerY + textRadius * Math.sin(textAngle);

                        // 희귀도 표시 (테두리 두께)
                        const strokeWidth = item.rarity === 'legendary' ? 4 :
                            item.rarity === 'epic' ? 3 :
                                item.rarity === 'rare' ? 2.5 : 2;

                        return (
                            <g key={item.id}>
                                {/* 섹션 */}
                                <path
                                    d={pathData}
                                    fill={getItemColor(item)}
                                    stroke="#ffffff"
                                    strokeWidth={strokeWidth}
                                    opacity={selectedIndex === index && !isSpinning ? 1 : 0.9}
                                />

                                {/* 텍스트 */}
                                <text
                                    x={textX}
                                    y={textY}
                                    fill="#ffffff"
                                    fontSize="12"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    transform={`rotate(${index * degreesPerItem + degreesPerItem / 2}, ${textX}, ${textY})`}
                                    className="pointer-events-none select-none"
                                >
                                    {item.text.length > 15 ? item.text.slice(0, 12) + '...' : item.text}
                                </text>
                            </g>
                        );
                    })}

                    {/* 중앙 원 */}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r="30"
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="3"
                    />
                    <text
                        x={centerX}
                        y={centerY}
                        fill="#ffffff"
                        fontSize="20"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none"
                    >
                        🔥
                    </text>
                </motion.svg>

                {/* 당첨 효과 */}
                {selectedIndex !== null && !isSpinning && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="rounded-full bg-amber-500/20 p-8 backdrop-blur-sm">
                            <span className="text-4xl">
                                {items[selectedIndex].rarity === 'legendary' ? '👑' :
                                    items[selectedIndex].rarity === 'epic' ? '💎' :
                                        items[selectedIndex].rarity === 'rare' ? '⭐' : '✨'}
                            </span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* 상태 표시 */}
            {isSpinning && (
                <div className="text-center">
                    <p className="animate-pulse text-lg font-bold text-amber-400">
                        룰렛을 돌리는 중...
                    </p>
                </div>
            )}
        </div>
    );
}
