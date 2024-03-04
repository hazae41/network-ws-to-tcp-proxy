FROM denoland/deno:latest

ARG port=8080

ENV PORT=$port

# The port that your application listens to.
EXPOSE $port

# Prefer not to run as root.
USER deno

# Create a new directory for your application.
WORKDIR /app

# These steps will be re-run upon each file change in your working directory:
ADD . .

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD ["run", "-A", "main.ts"]