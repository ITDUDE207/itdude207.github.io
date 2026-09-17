const CACHE_NAME = "thonny-pad-offline-v1";


/*
 * Files belonging to the application itself.
 */
const APP_FILES = [
    "./",
    "./index.html",
    "./script.js",
    "./manifest.json"
];


/*
 * Pyodide CDN.
 *
 * Keep this version synchronized with
 * the version used in index.html.
 */
const PYODIDE_CDN =
    "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";


/*
 * Install the service worker.
 */
self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            ).then(
                cache => {

                    return cache.addAll(
                        APP_FILES
                    );

                }
            )

        );


        /*
         * Activate immediately rather than
         * waiting for old pages to close.
         */
        self.skipWaiting();

    }
);


/*
 * Take control of existing pages.
 */
self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            Promise.all([

                self.clients.claim(),

                /*
                 * Remove old ThonnyPad caches.
                 */
                caches.keys().then(
                    keys => {

                        return Promise.all(

                            keys
                                .filter(
                                    key =>
                                        key.startsWith(
                                            "thonny-pad-"
                                        ) &&
                                        key !==
                                            CACHE_NAME
                                )
                                .map(
                                    key =>
                                        caches.delete(
                                            key
                                        )
                                )

                        );

                    }
                )

            ])

        );

    }
);


/*
 * Fetch handler.
 *
 * Strategy:
 *
 * 1. Check Cache Storage first.
 * 2. If cached, use it immediately.
 * 3. Otherwise download it.
 * 4. Save the downloaded response.
 * 5. Return it.
 *
 * This means that once a CDN file has been
 * downloaded successfully, it can be used
 * without internet later.
 */
self.addEventListener(
    "fetch",
    event => {

        const request =
            event.request;


        /*
         * Only cache GET requests.
         */
        if (
            request.method !== "GET"
        ) {
            return;
        }


        const url =
            new URL(
                request.url
            );


        /*
         * These are the resources we want
         * to cache:
         *
         * - our application
         * - Pyodide CDN
         * - jsDelivr
         * - PyPI package downloads
         */

        const shouldCache =
            url.origin ===
                self.location.origin ||

            url.hostname ===
                "cdn.jsdelivr.net" ||

            url.hostname ===
                "files.pythonhosted.org" ||

            url.hostname ===
                "pypi.org";


        if (!shouldCache) {
            return;
        }


        event.respondWith(

            caches.match(
                request
            ).then(
                cached => {

                    /*
                     * CACHE HIT
                     */
                    if (cached) {

                        return cached;

                    }


                    /*
                     * CACHE MISS
                     */
                    return fetch(
                        request
                    ).then(
                        response => {

                            /*
                             * Only save successful
                             * responses.
                             */

                            if (
                                response &&
                                (
                                    response.ok ||
                                    response.type ===
                                        "opaque"
                                )
                            ) {

                                const copy =
                                    response.clone();


                                caches.open(
                                    CACHE_NAME
                                ).then(
                                    cache => {

                                        cache.put(
                                            request,
                                            copy
                                        );

                                    }
                                );

                            }


                            return response;

                        }
                    );

                }
            ).catch(
                () => {

                    /*
                     * If offline and the request
                     * wasn't cached, return a
                     * normal offline response.
                     */

                    return new Response(
                        "Offline: this resource has not been cached yet.",
                        {
                            status: 503,
                            headers: {
                                "Content-Type":
                                    "text/plain"
                            }
                        }
                    );

                }
            )

        );

    }
);
