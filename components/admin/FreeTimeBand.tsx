'use client';
// Named exports only: a server page (the coach team page) imports this boundary, and Next refuses `export *` there.
export { default, useCustomerFreeTime } from '@/components/billing/FreeTimeBand';
