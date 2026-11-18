import {
  Bell, CircleHelp, CirclePlus, DatabaseBackup, House, KeyRound, LogOut, MapPin, Radio, ShieldUser,
  Medal, Swords, Trash2, TrendingUp, Trophy, UserRound, UsersRound,
} from "lucide-react";

const ICONS = {
  home: House, profile: UserRound, friends: UsersRound, add: CirclePlus, admin: ShieldUser, help: CircleHelp,
  logout: LogOut, trophy: Trophy, live: Radio, match: Swords, tournament: Medal, wins: TrendingUp, clubs: MapPin,
  backup: DatabaseBackup, password: KeyRound, bell: Bell, trash: Trash2,
} as const;

export type IconName = keyof typeof ICONS;

/** Icona del sito per nome (utilizzabile anche passando solo il nome da un componente server a uno client). */
export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  const C = ICONS[name];
  return <C aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
