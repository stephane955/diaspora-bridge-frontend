import type { Router } from 'expo-router';

type RouterLike = Pick<Router, 'back' | 'canGoBack' | 'replace'>;

/** Avoid GO_BACK errors when there is no screen in the navigation stack. */
export function safeGoBack(router: RouterLike, fallback: Parameters<RouterLike['replace']>[0] = '/') {
    if (router.canGoBack()) {
        router.back();
    } else {
        router.replace(fallback);
    }
}
