
# SeatBook — Mini BookMyShow

SeatBook is a simple seat booking web application inspired by movie ticket booking platforms like BookMyShow.

The app allows users to sign up and log in, create events, view upcoming events, select seats, make bookings, and manage their bookings. Event organisers can also see how many seats have been sold and view their attendees.

## Features

* User signup and login using Supabase Authentication
* Authenticated users can create events
* Automatic seat generation based on the number of rows and columns
* Upcoming events page
* Interactive seat map showing available, selected, and booked seats
* Maximum of 4 seats per booking
* Users can view their bookings
* Bookings can be cancelled before the event starts
* Organiser dashboard showing seats sold, revenue, and attendees
* Row Level Security (RLS) for protecting database data
* Database validation for important booking and event rules
* Protection against two users booking the same seat at the same time

## Technologies Used

* HTML
* CSS
* JavaScript
* Supabase Authentication
* Supabase PostgreSQL
* PostgreSQL RPC functions
* Row Level Security (RLS)

## Getting Started

### 1. Set up Supabase

Create a project on Supabase and open the **SQL Editor**.

Run the complete `schema.sql` file included in this repository. This creates the required tables, security policies, indexes, and database functions.

### 2. Add the Supabase details

The project uses the following configuration:

```text
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

The example values are provided in `.env.example`.

For this project, the Supabase Project URL and anon/public key can be found under **Project Settings → API**.

> Do not upload private keys or passwords to GitHub.

### 3. Connect the app

Open `app.js` and make sure the Supabase URL and anon key used by the application are configured correctly.

### 4. Run the application

The easiest way to run the project locally is with the **Live Server** extension in VS Code, or with any other local web server.

Open the website in your browser and create an account.

After logging in, you can create an event and test the seat booking system.

## Supabase Email Confirmation

Depending on the Supabase Authentication settings, a new account may need to confirm its email address before logging in.

For a classroom demonstration, the email-confirmation setting can be configured according to the requirements of the project.

## How Double-Booking Is Prevented

One of the important parts of SeatBook is making sure that two users cannot successfully book the same seat at the same time.

The database uses a **partial unique index**:

```sql
create unique index one_active_booking_per_seat
on public.bookings(seat_id)
where status = 'booked';
```

This means that a seat can only have one active (`booked`) booking.

The actual booking is handled by the PostgreSQL `book_seats()` function. When a user selects multiple seats, the selected seats are inserted together as part of the database operation.

If two users try to book the same seat at nearly the same time, PostgreSQL checks the unique index. Only one booking can be created for that seat. The other booking attempt receives a `unique_violation` error, which the function converts into a message telling the user that the seat was just booked by someone else.

This protection happens at the **database level**, rather than relying only on the frontend. This is important because two users could otherwise see the same seat as available and try to book it simultaneously.

Cancelled bookings are not included in the partial unique index, so a seat becomes available for booking again after its previous booking is cancelled.

The database also checks other important rules, including:

* The user must be logged in
* A maximum of 4 seats can be booked at once
* Seats must belong to the selected event
* Past events cannot be booked
* Event dates must be in the future
* Event rows and columns must stay within the allowed limits

## Row Level Security

SeatBook uses Supabase Row Level Security (RLS) to control access to the database.

The main rules are:

* Events can be viewed by users
* Seats can be viewed by users
* Only event owners can update or delete their events
* Users can view their own bookings
* Event owners can view bookings belonging to their events
* Event creation, seat creation, booking, and cancellation are handled through protected database functions

## Project Files

```text
index.html       → Main application page
style.css        → Website styling and responsive design
app.js           → Frontend application logic
schema.sql       → Database tables, security rules, indexes and functions
.env.example     → Example Supabase configuration
```

## Screenshots

Screenshots of the completed application will be added here.

The screenshots include the main parts of the application such as:

* Login / signup
* Upcoming events
* Create Event
* Seat selection
* My Bookings
* Organiser dashboard

## Deployed Application

**Live Demo:**
Add the deployed website link here after deployment.

## What I Learned

This project helped me understand how a frontend application can work together with a real backend database.

Some of the main things I worked with were Supabase Authentication, PostgreSQL tables, Row Level Security, database functions, seat generation, booking logic, and handling concurrent booking attempts.

The double-booking requirement was especially important because simply checking whether a seat is available in JavaScript is not enough when multiple users can try to book the same seat at the same time. The final protection is therefore handled by PostgreSQL.

## Future Improvements

Some features that could be added in the future include:

* Real-time seat updates
* Temporary seat holds
* Event categories and search
* QR-code tickets
* Event cover images
* Automated concurrency testing
* More advanced filtering and sorting
* Deployment and production optimisation

