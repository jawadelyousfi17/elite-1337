import type { ComponentType } from 'react';
import {
  ArrowDown as PhArrowDown, ArrowLeft as PhArrowLeft, ArrowRight as PhArrowRight, ArrowUpRight as PhArrowUpRight, ArrowDownRight as PhArrowDownRight, ArrowsClockwise, CaretDown, CaretLeft, CaretRight, CaretUp,
  ChartLineUp, Check as PhCheck, ClockCountdown, Desktop, FolderSimple, GridFour, Lock, MagnifyingGlass, MagnifyingGlassMinus, MagnifyingGlassPlus,
  ArrowCounterClockwise, Buildings, GithubLogo, InstagramLogo, LinkedinLogo, HourglassMedium, HourglassHigh, CalendarBlank, CalendarDots, FunnelSimple,
  ChartBar, CrownSimple, ArrowsDownUp, WhatsappLogo, CreditCard as PhCreditCard, Gift as PhGift, Cloud as PhCloud, Globe as PhGlobe, Briefcase as PhBriefcase, ShieldCheck as PhShieldCheck, Snowflake as PhSnowflake, DiscordLogo, Envelope, Plus as PhPlus, Trash as PhTrash, Calculator as PhCalculator, ArrowUp as PhArrowUp, Minus as PhMinus, Info as PhInfo, Sun as PhSun, Moon as PhMoon, Star as PhStar, Coffee as PhCoffee, Heart as PhHeart, GraduationCap, Heartbeat, TrendUp as PhTrendUp, TrendDown as PhTrendDown, Ranking as PhRanking,
  ChatTeardropText, Bug as PhBug, MapPin as PhMapPin, MapTrifold, SpeakerHigh, SpeakerSlash, Question, SignOut, SlidersHorizontal as PhSliders, Trophy as PhTrophy, User, Wallet as PhWallet, Waves as PhWaves, X as PhX,
} from '@phosphor-icons/react/dist/ssr';
import type { IconProps as PhIconProps } from '@phosphor-icons/react';

export type IconProps = Omit<PhIconProps, 'weight'> & { strokeWidth?: number; fill?: string; weight?: PhIconProps['weight'] };

function icon(Base: ComponentType<PhIconProps>, defaultWeight: PhIconProps['weight'] = 'regular') {
  function Icon({ size = 24, strokeWidth: _strokeWidth, fill, weight, ...props }: IconProps) {
    return <Base size={size} weight={weight ?? (fill && fill !== 'none' ? 'fill' : defaultWeight)} aria-hidden={props['aria-label'] ? undefined : true} {...props}/>;
  }
  return Icon;
}

export const ArrowDown = icon(PhArrowDown);
export const ArrowLeft = icon(PhArrowLeft);
export const ArrowRight = icon(PhArrowRight);
export const ArrowUpRight = icon(PhArrowUpRight);
export const ArrowDownRight = icon(PhArrowDownRight);
export const ChartNoAxesCombined = icon(ChartLineUp);
export const Check = icon(PhCheck, 'bold');
export const ChevronDown = icon(CaretDown, 'bold');
export const ChevronLeft = icon(CaretLeft, 'bold');
export const ChevronRight = icon(CaretRight, 'bold');
export const ChevronUp = icon(CaretUp, 'bold');
export const CircleHelp = icon(Question);
export const Clock3 = icon(ClockCountdown);
export const FolderKanban = icon(FolderSimple);
export const LayoutGrid = icon(GridFour);
export const LockKeyhole = icon(Lock);
export const LogOut = icon(SignOut);
export const MapPin = icon(PhMapPin);
export const MapPinned = icon(MapTrifold);
export const Monitor = icon(Desktop);
export const RefreshCw = icon(ArrowsClockwise);
export const Search = icon(MagnifyingGlass);
export const SlidersHorizontal = icon(PhSliders);
export const Trophy = icon(PhTrophy);
export const UserRound = icon(User);
export const Wallet = icon(PhWallet);
export const Waves = icon(PhWaves);
export const X = icon(PhX, 'bold');
export const ZoomIn = icon(MagnifyingGlassPlus);
export const ZoomOut = icon(MagnifyingGlassMinus);
export const Campus = icon(Buildings);
export const Cohort = icon(CalendarDots);
export const Calendar = icon(CalendarBlank);
export const RotateCcw = icon(ArrowCounterClockwise, 'bold');
export const Funnel = icon(FunnelSimple);
export const Hourglass = icon(HourglassMedium);
/** Waiting for correction: sand still on top. */
export const Corrections = icon(HourglassHigh);
export const GitHub = icon(GithubLogo, 'fill');
export const Instagram = icon(InstagramLogo, 'fill');
export const LinkedIn = icon(LinkedinLogo, 'fill');
export const Students = icon(GraduationCap);
export const Survival = icon(Heartbeat);
export const BarChart = icon(ChartBar);
export const TrendUp = icon(PhTrendUp, 'bold');
export const TrendDown = icon(PhTrendDown, 'bold');
export const Ranking = icon(PhRanking);
export const Coffee = icon(PhCoffee);
export const Heart = icon(PhHeart);
export const Star = icon(PhStar);
export const Sun = icon(PhSun);
export const Moon = icon(PhMoon);
export const Info = icon(PhInfo);
export const Briefcase = icon(PhBriefcase);
export const ShieldCheck = icon(PhShieldCheck);
export const Gift = icon(PhGift);
export const Cloud = icon(PhCloud);
export const Globe = icon(PhGlobe);
export const CreditCard = icon(PhCreditCard);
export const WhatsApp = icon(WhatsappLogo, 'fill');
export const Reverse = icon(ArrowsDownUp, 'bold');
export const Crown = icon(CrownSimple, 'fill');
export const Sound = icon(SpeakerHigh);
export const Muted = icon(SpeakerSlash);
export const ChatText = icon(ChatTeardropText);
export const Bug = icon(PhBug);
export const Snowflake = icon(PhSnowflake);
export const Discord = icon(DiscordLogo);
export const Mail = icon(Envelope);
export const Plus = icon(PhPlus, 'bold');
export const Trash = icon(PhTrash);
export const Calculator = icon(PhCalculator);
export const ArrowUp = icon(PhArrowUp, 'bold');
export const Minus = icon(PhMinus, 'bold');
