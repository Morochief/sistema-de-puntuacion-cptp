export function navigate(hash: string): void {
 window.location.hash = hash;
}

export function getRoute(): { view: string; params: Record<string, string> } {
 const hash = window.location.hash.slice(1) || '/';
 if (hash === '/' || hash === '') return { view: 'dashboard', params: {} };

 const matchEvent = hash.match(/^\/event\/([a-zA-Z0-9-]+)$/);
 if (matchEvent) return { view: 'event', params: { id: matchEvent[1] } };

 const matchSeries = hash.match(/^\/series\/([a-zA-Z0-9-]+)$/);
 if (matchSeries) return { view: 'series', params: { id: matchSeries[1] } };

 if (hash === '/new') return { view: 'new-event', params: {} };

 return { view: 'dashboard', params: {} };
}

export function showView(viewId: string): void {
 document.querySelectorAll('.view').forEach(el => (el as HTMLElement).classList.add('hidden'));
 const el = document.getElementById(`view-${viewId}`);
 if (el) el.classList.remove('hidden');
}
