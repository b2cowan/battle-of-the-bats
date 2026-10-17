// ⚖ The icons are the nav standard's dictionary (docs/agents/design/NAV_STANDARD.md N5, owner 2026-10-17): one
// icon per idea. The Dashboard is a gauge (the dashboard grid matched the club's Overview at 14px), Results a medal
// (the trophy is Tournaments in every portal), Public site the globe it wears in the club sidebar.
import {
  Gauge, Users, Calendar, Medal, Mail,
  Settings2, MapPin, Tag, BookOpen, Globe,
  Settings, Trophy, UserCheck, QrCode, MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export type TourNavItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  roles?: string[];
};

export type TourGroup = {
  key: string;
  label: string;
  defaultOpenFor: string[];
  items: TourNavItem[];
};

export const TOUR_GROUPS: TourGroup[] = [
  {
    key: 'operations',
    label: 'Operations',
    defaultOpenFor: ['draft', 'active', 'completed'],
    items: [
      { key: 'dashboard',     icon: Gauge,           label: 'Dashboard'      },
      { key: 'registrations', icon: Users,           label: 'Teams'          },
      { key: 'schedule',      icon: Calendar,        label: 'Schedule'       },
      { key: 'results',       icon: Medal,           label: 'Results'        },
      { key: 'check-in',      icon: UserCheck,       label: 'Check-in'       },
      { key: 'staff-kit',     icon: QrCode,          label: 'Staff Kit'      },
      { key: 'communication', icon: Mail,            label: 'Communications' },
      { key: 'chat',          icon: MessageSquare,   label: 'Chat'           },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    defaultOpenFor: ['draft'],
    items: [
      { key: 'settings/event', icon: Settings2,  label: 'Event Settings',     roles: ['owner', 'admin'] },
      { key: 'venues',         icon: MapPin,     label: 'Venues & Facilities'                            },
      { key: 'divisions',      icon: Tag,        label: 'Divisions'                                      },
      { key: 'rules',          icon: BookOpen,   label: 'Rules & Resources'                              },
      { key: 'branding',       icon: Globe,      label: 'Public Site'                                    },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    defaultOpenFor: [],
    items: [
      // ⚰ Data tools retired (Stage 5, E10, A59): each import lives with its data — Teams' Export, the schedule's Tools.
      { key: 'settings',   icon: Settings, label: 'Settings & Access' },
      // The one Tournaments list (D7, ruled 2026-10-06): it took Past tournaments' place here — an occasional
      // destination, so a row in Admin, not the top of the rail (D7a). The trophy, Tournaments' icon everywhere (N5).
      { key: 'manage',     icon: Trophy,   label: 'Tournaments'       },
    ],
  },
];
