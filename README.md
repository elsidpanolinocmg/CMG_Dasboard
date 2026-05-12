# CMG_Dashboard

Rebuild of the CMG dashboard with a clean entity model, generic typed cache, and admin CRUD for every entity.

Stack: Next.js 16 + TypeScript + MongoDB + Tailwind 4.

See `docs/architecture.md` for the entity model and `C:\Users\HP\.claude\plans\logical-coalescing-crayon.md` for the build plan.





Step-by-Step GTM Scroll Configuration
Disable Default Tracking: To avoid double-counting the 90% milestone, go to your GA4 Admin > Data Streams, select your stream, and toggle Scrolls to Off under Enhanced measurement settings.

Enable GTM Variables: In your GTM container, go to Variables > Configure. In the "Scrolling" section, check Scroll Depth Threshold, Scroll Depth Units, and Scroll Depth Direction.

Create a Scroll Trigger:
Go to Triggers > New and choose the Scroll Depth trigger type.
Select Vertical Scroll Depths and enter your desired percentages (e.g., 25, 50, 75, 90).
Set it to fire on "All Pages" and save it as "Scroll Trigger".

Create the GA4 Event Tag:
Go to Tags > New and select Google Analytics: GA4 Event.
Event Name: scroll
Event Parameter: Add a row with the parameter name percent_scrolled and the value {{Scroll Depth Threshold}}.
Triggering: Select your new "Scroll Trigger".

Register the Custom Dimension: This is the most critical step for GA4 reporting. In your GA4 Admin > Custom definitions, create a new event-scoped dimension named Percent Scrolled and map it to the percent_scrolled parameter.

Preview and Publish: Use the GTM Preview mode to verify that the tag fires at each percentage as you scroll down your site. Once confirmed, Submit your changes