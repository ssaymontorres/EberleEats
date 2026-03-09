import { Category, DayOfWeek } from '@prisma/client';

export interface ParsedMenuItem {
    category: Category;
    dishes: string[];
    reservationCode?: number;
    reservationDate?: Date;
}

export interface ParsedMenuDay {
    dayOfWeek: DayOfWeek;
    date: Date;
    items: ParsedMenuItem[];
}

export interface ParsedMenu {
    weekStart: Date;
    weekEnd: Date;
    rawText: string;
    days: ParsedMenuDay[];
}

export interface EvolutionApiPayload {
    number: string;
    text: string;
}

export interface EvolutionApiResponse {
    key: {
        id: string;
        remoteJid: string;
    };
    status: string;
}
