This tool would not exist without the hard work of the Notesnook team. This conversion heavily borrows from the official server, [which you can find here](https://github.com/streetwriters/notesnook-sync-server/tree/master/Notesnook.Inbox.API). 

## Deployment
1. `git clone` this repository on your computer.
2. Run `npm i` to install the dependencies.
3. Run `wrangler deploy` to deploy it to CloudFlare.
4. Finish configuring everything in the CloudFlare dashboard. (Alternatively, you can do it in `wrangler.jsonc` before deploying).

## Things you should know
- This is meant for a single person, multiple people using the same deployment may run into problems. Read below.
- Isolate reuse is bad. It will make your deployment OOM very hard if inbound requests come in quickly and are routed to the same isolate. There's a way to try to work around this by using Durable Objects if it becomes a real problem for you. I did not do this. I do not care.
- There is no size limit for objects sent here. This means the sync server may reject them. 
- There is no rate limiting of any kind. Not that it'd help much, ~10 requests in flight is all it really takes to OOM the server if those requests are large.
- CPU time is quite high, but it's not high enough that you *can't* get away with using the free plan. Your mileage may vary. 