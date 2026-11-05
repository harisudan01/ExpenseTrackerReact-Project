import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

const setup = () => {
  const onPreview = vi.fn();
  const onDownload = vi.fn();
  render(
    <div>
      <Menu
        title="Report"
        trigger={<span>open</span>}
        items={[
          { label: 'Preview', icon: null, onClick: onPreview },
          { label: 'Download', icon: null, onClick: onDownload },
        ]}
      />
      <p>outside</p>
    </div>,
  );
  return { onPreview, onDownload, user: userEvent.setup() };
};

describe('Menu', () => {
  it('opens on click and runs the chosen item, then closes', async () => {
    const { user, onDownload } = setup();
    const trigger = screen.getByTitle('Report');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Download' }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on outside click and on Escape', async () => {
    const { user } = setup();
    await user.click(screen.getByTitle('Report'));
    await user.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Report'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders the list outside clipping parents (regression: Report menu hidden inside book cards)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: 'hidden' }} data-testid="card">
        <Menu title="Report" trigger={<span>open</span>} items={[{ label: 'Preview', icon: null, onClick: () => {} }]} />
      </div>,
    );
    await user.click(screen.getByTitle('Report'));
    const menu = screen.getByRole('menu');
    expect(screen.getByTestId('card')).not.toContainElement(menu);
    expect(container).not.toContainElement(menu);
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: 'fixed' });
  });

  it('opens below the button, or above it near the bottom of the screen', async () => {
    const { user } = setup();
    const trigger = screen.getByTitle('Report');
    const place = (top: number) =>
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top, bottom: top + 36, left: 900, right: 936, width: 36, height: 36, x: 900, y: top, toJSON: () => ({}),
      } as DOMRect);

    place(100); // plenty of room below (jsdom window is 768px tall)
    await user.click(trigger);
    expect(screen.getByRole('menu')).toHaveStyle({ top: '142px', right: `${window.innerWidth - 936}px` });
    await user.click(trigger);

    place(700); // near the bottom: flip upward
    await user.click(trigger);
    expect(screen.getByRole('menu')).toHaveStyle({ bottom: `${window.innerHeight - 700 + 6}px` });
  });

  it('closes when the page scrolls', async () => {
    const { user } = setup();
    await user.click(screen.getByTitle('Report'));
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const { user } = setup();
    await user.click(screen.getByTitle('Report'));
    await user.click(screen.getByTitle('Report'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
