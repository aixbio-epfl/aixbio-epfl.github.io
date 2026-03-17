function parseEventDate(dateString) {
    if (typeof dateString !== 'string') {
        return null;
    }

    const match = dateString.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
        return null;
    }

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    const parsedDate = new Date(year, month - 1, day);

    if (
        Number.isNaN(parsedDate.getTime())
        || parsedDate.getFullYear() !== year
        || parsedDate.getMonth() !== month - 1
        || parsedDate.getDate() !== day
    ) {
        return null;
    }

    return parsedDate;
}

function formatEventDateForDisplay(dateString) {
    const date = parseEventDate(dateString);

    if (!date) {
        return dateString || '';
    }

    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function normalizeTalks(talks) {
    if (!Array.isArray(talks)) {
        return [];
    }

    return talks
        .map((talk) => {
            if (Array.isArray(talk) && talk.length >= 2) {
                return {
                    speaker: String(talk[0] || '').trim(),
                    title: String(talk[1] || '').trim()
                };
            }

            if (talk && typeof talk === 'object') {
                return {
                    speaker: String(talk.speaker || '').trim(),
                    title: String(talk.title || '').trim(),
                    speakerUrl: String(talk.speaker_url || talk.speakerUrl || talk.url || '').trim()
                };
            }

            return {
                speaker: '',
                title: '',
                speakerUrl: ''
            };
        })
        .filter((talk) => talk.speaker || talk.title);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeUrl(url) {
    if (!url) {
        return '';
    }

    try {
        const parsedUrl = new URL(url);
        const allowedProtocols = ['http:', 'https:'];

        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            return '';
        }

        return parsedUrl.href;
    } catch {
        return '';
    }
}

function parseSpeakerMarkdownLink(speakerValue) {
    if (typeof speakerValue !== 'string') {
        return null;
    }

    const match = speakerValue.trim().match(/^\[(.+)\]\((https?:\/\/[^\s)]+)\)$/i);

    if (!match) {
        return null;
    }

    return {
        text: match[1].trim(),
        url: normalizeUrl(match[2].trim())
    };
}

function renderSpeaker(talk) {
    const markdownLink = parseSpeakerMarkdownLink(talk.speaker);

    if (markdownLink && markdownLink.url) {
        return `<a class="talk-speaker" href="${escapeHtml(markdownLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(markdownLink.text || 'Speaker TBA')}</a>`;
    }

    const safeSpeakerUrl = normalizeUrl(talk.speakerUrl);
    const speakerName = escapeHtml(talk.speaker || 'Speaker TBA');

    if (safeSpeakerUrl) {
        return `<a class="talk-speaker" href="${escapeHtml(safeSpeakerUrl)}" target="_blank" rel="noopener noreferrer">${speakerName}</a>`;
    }

    return `<span class="talk-speaker">${speakerName}</span>`;
}

function renderTalks(talks) {
    const normalizedTalks = normalizeTalks(talks);

    if (normalizedTalks.length === 0) {
        return '';
    }

    const talksList = normalizedTalks
        .map((talk) => {
            const speaker = renderSpeaker(talk);
            const hasTitle = Boolean(talk.title);

            if (!hasTitle) {
                return `
                    <li class="talk-item">
                        ${speaker}
                    </li>
                `;
            }

            return `
                <li class="talk-item">
                    ${speaker}
                    <span class="talk-separator"> — </span>
                    <span class="talk-title">${escapeHtml(talk.title)}</span>
                </li>
            `;
        })
        .join('');

    return `
        <div class="talks-block">
            <h4 class="talks-heading">Talks</h4>
            <ul class="talks-list">${talksList}</ul>
        </div>
    `;
}

function renderEventMeta(event) {
    const time = typeof event.time === 'string' ? event.time.trim() : '';
    const place = typeof event.place === 'string' ? event.place.trim() : '';

    if (!time && !place) {
        return '';
    }

    const safeTime = time ? `<span class="event-time">${escapeHtml(time)}</span>` : '';
    const safePlace = place ? `<span class="event-place">${escapeHtml(place)}</span>` : '';
    const separator = time && place ? '<span class="event-meta-separator"> | </span>' : '';

    return `
        <p class="event-meta">${safeTime}${separator}${safePlace}</p>
    `;
}

function sortEventsByDate(events, direction = 'asc') {
    const factor = direction === 'desc' ? -1 : 1;

    return [...events].sort((firstEvent, secondEvent) => {
        const firstDate = parseEventDate(firstEvent.date);
        const secondDate = parseEventDate(secondEvent.date);

        if (!firstDate && !secondDate) {
            return 0;
        }

        if (!firstDate) {
            return 1;
        }

        if (!secondDate) {
            return -1;
        }

        return (firstDate - secondDate) * factor;
    });
}

function splitEventsByDate(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEvents = [];
    const pastEvents = [];

    events.forEach((event) => {
        const eventDate = parseEventDate(event.date);

        if (eventDate && eventDate < today) {
            pastEvents.push(event);
            return;
        }

        upcomingEvents.push(event);
    });

    return {
        upcomingEvents: sortEventsByDate(upcomingEvents, 'asc'),
        pastEvents: sortEventsByDate(pastEvents, 'desc')
    };
}

function findNextUpcomingEvent(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const datedEvents = events
        .map((event) => ({
            event,
            date: parseEventDate(event.date)
        }))
        .filter((entry) => entry.date !== null);

    const futureEvents = datedEvents
        .filter((entry) => entry.date >= today)
        .sort((a, b) => a.date - b.date);

    if (futureEvents.length > 0) {
        return futureEvents[0].event;
    }

    return datedEvents.length > 0 ? datedEvents.sort((a, b) => a.date - b.date)[0].event : null;
}

function renderEvents(events, containerId, highlightedEvent = null, cardVariant = '') {
    const eventsContainer = document.getElementById(containerId);

    if (!eventsContainer) {
        return;
    }

    eventsContainer.innerHTML = '';

    events.forEach((event) => {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';

        if (cardVariant) {
            eventCard.classList.add(cardVariant);
        }

        if (highlightedEvent && event === highlightedEvent) {
            eventCard.classList.add('next-event');
        }

        eventCard.innerHTML = `
            <div class="event-date">${formatEventDateForDisplay(event.date)}</div>
            ${renderEventMeta(event)}
            <h3 class="event-title">${event.title || 'Untitled Event'}</h3>
            <p class="event-description">${event.description || ''}</p>
            ${renderTalks(event.talks)}
        `;

        eventsContainer.appendChild(eventCard);
    });
}

function setEventsMessage(message, containerId) {
    const eventsContainer = document.getElementById(containerId);

    if (!eventsContainer) {
        return;
    }

    eventsContainer.innerHTML = `<p class="event-description">${message}</p>`;
}

function initBackgroundParallax() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    let ticking = false;

    const updateParallax = () => {
        document.documentElement.style.setProperty('--parallax-offset', `${window.scrollY}px`);
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }, { passive: true });

    updateParallax();
}

async function loadEventsFromYaml() {
    try {
        const response = await fetch('events.yaml');

        if (!response.ok) {
            throw new Error(`Failed to load events.yaml (${response.status})`);
        }

        const yamlText = await response.text();
        const parsed = jsyaml.load(yamlText) || {};
        const allEvents = Array.isArray(parsed.events)
            ? parsed.events
            : [
                ...(Array.isArray(parsed.upcoming_events) ? parsed.upcoming_events : []),
                ...(Array.isArray(parsed.past_events) ? parsed.past_events : [])
            ];
        const { upcomingEvents, pastEvents } = splitEventsByDate(allEvents);

        if (upcomingEvents.length === 0) {
            setEventsMessage('No upcoming events yet.', 'upcoming-events-list');
        } else {
            const nextUpcomingEvent = findNextUpcomingEvent(upcomingEvents);
            renderEvents(upcomingEvents, 'upcoming-events-list', nextUpcomingEvent);
        }

        if (pastEvents.length === 0) {
            setEventsMessage('No past events yet.', 'past-events-list');
        } else {
            renderEvents(pastEvents, 'past-events-list', null, 'past-event');
        }
    } catch (error) {
        setEventsMessage('Could not load events. Please check events.yaml.', 'upcoming-events-list');
        setEventsMessage('Could not load events. Please check events.yaml.', 'past-events-list');
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setEventsMessage('Loading events...', 'upcoming-events-list');
    setEventsMessage('Loading events...', 'past-events-list');
    initBackgroundParallax();
    loadEventsFromYaml();
});