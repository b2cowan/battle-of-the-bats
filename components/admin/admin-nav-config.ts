import {
  LayoutDashboard, Users, Calendar, Trophy, Mail,
  Settings2, MapPin, Tag, BookOpen, Paintbrush,
  Settings, Archive,
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
      { key: 'communication', icon: Mail,            label: 'Communications' },
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
      { key: 'settings', icon: Settings, label: 'Settings & Access' },
      { key: 'archives', icon: Archive,  label: 'Past Tournaments'  },
    ],
  },
];
