import 'server-only';

export type RuntimeBooleanOverride = boolean | null;

type DevRuntimeFlags = {
  billingMockOverride?: RuntimeBooleanOverride;
};

type DevRuntimeGlobal = typeof globalThis & {
  __fieldlogicDevRuntimeFlags?: DevRuntimeFlags;
};

function getStore(): DevRuntimeFlags {
  const runtimeGlobal = globalThis as DevRuntimeGlobal;
  runtimeGlobal.__fieldlogicDevRuntimeFlags ??= {};
  return runtimeGlobal.__fieldlogicDevRuntimeFlags;
}

export function getBillingMockOverride(): RuntimeBooleanOverride {
  return getStore().billingMockOverride ?? null;
}

export function setBillingMockOverride(value: RuntimeBooleanOverride): void {
  getStore().billingMockOverride = value;
}
