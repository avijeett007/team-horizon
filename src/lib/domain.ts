export type CalendarStatus = "available" | "tentative" | "busy" | "leave";
export type LeaveCertainty = "confirmed" | "provisional";

export interface CalendarEntry {
  id: number;
  memberId: number;
  seriesId?: number | null;
  projectId: number | null;
  status: CalendarStatus;
  note: string | null;
  leaveCertainty: LeaveCertainty | null;
  startsAtUtc: string;
  endsAtUtc: string;
  originalDate: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  location: string;
  timezone: string;
  active: boolean;
  ventureIds: number[];
  projectIds: number[];
}

export interface Venture {
  id: number;
  name: string;
  colour: string;
  active: boolean;
}

export interface Project {
  id: number;
  ventureId: number;
  name: string;
  colour: string;
  active: boolean;
}
