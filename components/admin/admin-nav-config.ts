import {
  LayoutDashboard, Users, Calendar, Trophy, Mail,
  Settings2, MapPin, Tag, BookOpen, Paintbrush,
  Settings, List, Database, UserCheck, QrCode, MessageSquare,
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
      { key: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
      { key: 'registrations', icon: Users,           label: 'Teams'          },
      { key: 'schedule',      icon: Calendar,        label: 'Schedule'       },
      { key: 'results',       icon: Trophy,          label: 'Results'        },
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
      { key: 'branding',       icon: Paintbrush, label: 'Public Site'                                    },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    defaultOpenFor: [],
    items: [
      { key: 'data-tools', icon: Database, label: 'Data Tools'       },
      { key: 'settings',   icon: Settings, label: 'Settings & Access' },
      // The one Tournaments list (D7, ruled 2026-10-06): it took Past tournaments' place here — an occasional
      // destination, so a row in Admin, not the top of the rail (D7a). A list mark: Results wears the trophy.
      { key: 'manage',     icon: List,     label: 'Tournaments'       },
    ],
  },
];
