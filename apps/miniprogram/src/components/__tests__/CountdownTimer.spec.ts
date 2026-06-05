import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CountdownTimer from '../CountdownTimer.vue';

const now = new Date('2026-06-06T00:00:00.000Z');

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a number timestamp without NaN', async () => {
    const wrapper = mount(CountdownTimer, {
      props: { endTime: now.getTime() + 2 * 60 * 60 * 1000 },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('02');
    expect(wrapper.text()).not.toContain('NaN');
  });

  it('renders an ISO string timestamp without NaN', async () => {
    const wrapper = mount(CountdownTimer, {
      props: { endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('01天');
    expect(wrapper.text()).not.toContain('NaN');
  });

  it('marks expired values as ended', async () => {
    const wrapper = mount(CountdownTimer, {
      props: { endTime: now.getTime() - 1000 },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('已结束');
  });

  it('marks invalid values as ended instead of rendering NaN', async () => {
    const wrapper = mount(CountdownTimer, {
      props: { endTime: 'not-a-date' },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('已结束');
    expect(wrapper.text()).not.toContain('NaN');
  });
});
