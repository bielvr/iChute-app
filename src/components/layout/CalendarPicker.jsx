// components/CalendarPicker.jsx

import { useState } from "react";

import {
    formatCalendarDate,
    isToday,
    changeMonth,
    buildCalendarDays,
    toInputDate
} from "../utils/date";

export default function CalendarPicker({
    selectedDate,
    gamesPerDay = {},
    onSelectDate
}) {

    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(
        selectedDate
            ? new Date(`${selectedDate}T12:00:00`)
            : new Date()
    );

    const handleSelectDate = (date) => {
        onSelectDate(date);
        setCurrentMonth(new Date(`${date}T12:00:00`));
        setIsOpen(false);
    };

    const handleToday = () => {
        const today = toInputDate(new Date());
        onSelectDate(today);
        setCurrentMonth(new Date());
        setIsOpen(false);
    };

    return (
        <div className="relative w-full">

            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-[#1A1C3A] border border-[#26283A] p-4 rounded-2xl font-black italic uppercase text-[#0077FF] flex justify-between items-center cursor-pointer select-none"
            >

                <span className="text-sm tracking-wide">
                    {formatCalendarDate(selectedDate)}
                </span>

                <span
                    className={`text-xs transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                >
                    ▼
                </span>
            </div>

            {isOpen && (
                <div className="absolute top-[115%] left-0 w-full bg-[#141733] border border-[#26283A] rounded-[25px] p-4 z-50 shadow-2xl animate-fadeIn">
                    <div className="flex justify-between items-center mb-4 px-2">

                        <button
                            onClick={() =>
                                setCurrentMonth(changeMonth(currentMonth, -1))
                            }
                            className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg"
                        >
                            ‹
                        </button>

                        <span className="font-black italic uppercase text-xs sm:text-sm tracking-wide text-white">
                            {currentMonth.toLocaleDateString(
                                "pt-BR",
                                {
                                    month: "long",
                                    year: "numeric"
                                }
                            )}
                        </span>

                        <button
                            onClick={() =>
                                setCurrentMonth(changeMonth(currentMonth, 1))
                            }
                            className="text-[#0077FF] font-black text-lg p-1 px-3 bg-[#1A1C3A] rounded-lg"
                        >
                            ›
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500 uppercase mb-2">
                        <div>Dom</div>
                        <div>Seg</div>
                        <div>Ter</div>
                        <div>Qua</div>
                        <div>Qui</div>
                        <div>Sex</div>
                        <div>Sáb</div>
                    </div>

                    <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                        {buildCalendarDays(
                            currentMonth,
                            gamesPerDay
                        ).map((item, index) => {
                            if (!item) {
                                return <div key={index} />;
                            }
                            const selected =
                                item.dateString === selectedDate;
                            return (
                                <button
                                    key={item.dateString}
                                    onClick={() =>
                                        handleSelectDate(item.dateString)
                                    }
                                    className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                                        selected
                                            ? "bg-[#0077FF] text-white font-black scale-105"
                                            : isToday(item.dateString)
                                                ? "bg-[#1A1C3A] border border-[#0077FF] text-white"
                                                : "hover:bg-[#1A1C3A] text-gray-300"
                                    }`}
                                >
                                    <span className="text-xs font-bold">
                                        {item.day}
                                    </span>
                                    {item.games > 0 && (
                                        <span
                                            className={`text-[8px] mt-0.5 block w-3.5 h-3.5 leading-[14px] text-center rounded-full font-black ${
                                                selected
                                                    ? "bg-white text-[#0077FF]"
                                                    : "bg-[#26283A] text-gray-400"
                                            }`}
                                        >
                                            {item.games}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-2 border-t border-[#26283A] flex justify-center">
                        <button
                            onClick={handleToday}
                            className="bg-[#1A1C3A] border border-[#26283A] text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                        >
                            Hoje
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}