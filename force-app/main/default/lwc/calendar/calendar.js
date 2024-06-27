import { LightningElement, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FullCalendarJS from '@salesforce/resourceUrl/FullCalendarJS';
import createEvent from '@salesforce/apex/CalendarController.createEvent';

/**
 * FullCalendarJs
 * @description Full Calendar JS - Lightning Web Components
 */
export default class FullCalendarJs extends LightningElement {

    // to avoid the recursion from renderedcallback
    fullCalendarJsInitialised = false;

    // fields to store the event data
    title;
    startDate;
    endDate;

    eventsRendered = false; // to render initial events only once
    openSpinner = false; // to open the spinner in waiting screens
    openModal = false; // to open form

    @track
    events = []; // all calendar events are stored in this field

    // to store the orignal wire object to use in refreshApex method
    eventOriginalData = [];

    /**
     * @description Standard lifecyle method 'renderedCallback'
     *              Ensures that the page loads and renders the 
     *              container before doing anything else
     */
    renderedCallback() {

        // performs this operation only on first render
        if (this.fullCalendarJsInitialised) {
            return;
        }
        this.fullCalendarJsInitialised = true;

        // executes all loadScript and loadStyle promises and only resolves them once all promises are done
        Promise.all([
            loadScript(this, FullCalendarJS + '/jquery.min.js'),
            loadScript(this, FullCalendarJS + '/moment.min.js'),
            loadScript(this, FullCalendarJS + '/fullcalendar.min.js'),
            loadStyle(this, FullCalendarJS + '/fullcalendar.min.css'),
            // loadStyle(this, FullCalendarJS + '/fullcalendar.print.min.css')
        ])
            .then(() => {
                // ensure jQuery is available globally
                window.$ = window.jQuery;
                // initialize the full calendar
                this.initialiseFullCalendarJs();
            })
            .catch(error => {
                console.error({
                    message: 'Error occured on FullCalendarJS',
                    error
                });
            })
    }

    /**
     * @description Initialise the calendar configuration
     *              This is where we configure the available options for the calendar.
     *              This is also where we load the Events data.
     */
    initialiseFullCalendarJs() {

        const ele = this.template.querySelector('div.fullcalendarjs');

        $(ele).fullCalendar({
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'month,basicWeek,basicDay'
            },
            defaultDate: new Date(), // default day is today
            navLinks: true, // can click day/week names to navigate views
            editable: true,
            eventLimit: true, // allow "more" link when too many events
            events: [
                {
                    title: 'Day 1',
                    start: '2024-06-24T09:00:00',
                    end: '2024-06-24T15:00:00',
                },
                {
                    title: 'Day 2',
                    start: '2024-06-25T09:00:00',
                    end: '2024-06-25T15:00:00',
                },
                {
                    title: 'Day 3',
                    start: '2024-06-26T09:00:00',
                    end: '2024-06-26T16:00:00',
                },
            ]
        });
    }

    /**
     * @description Save a new event
     * @param {*} event 
     */
    handleSave(event) {
        let events = this.events;
        this.openSpinner = true;

        // get all the field values - as of now they all are mandatory to create a standard event
        // TODO- you need to add your logic here.
        this.template.querySelectorAll('lightning-input').forEach(ele => {
            if (ele.name === 'title') {
                this.title = ele.value;
            }
            if (ele.name === 'start') {
                this.startDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
            }
            if (ele.name === 'end') {
                this.endDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
            }
        });

        // format as per fullcalendar event object to create and render
        let newevent = { title: this.title, start: this.startDate, end: this.endDate };
        console.log('new event: ', JSON.stringify(newevent));

        // close the modal
        this.openModal = false;

        // server call to create the event
        createEvent({ 'event': JSON.stringify(newevent) })
            .then(result => {
                const ele = this.template.querySelector("div.fullcalendarjs");

                // to populate the event on fullcalendar object
                // id should be unique and useful to remove the event from UI - calendar
                newevent.id = result;

                // renderEvent is a fullcalendar method to add the event to calendar on UI
                // Documentation: https://fullcalendar.io/docs/v3/renderEvent
                $(ele).fullCalendar('renderEvent', newevent, true);

                // to display on UI with id from server
                this.events.push(newevent);

                // to close spinner and modal
                this.openSpinner = false;

                // show success toast message
                this.showNotification('Success!!', 'Your event has been logged', 'success');

            })
            .catch(error => {
                console.log(error);
                this.openSpinner = false;

                // show error toast message
                this.showNotification('Oops', 'Something went wrong, please review console', 'error');
            })
    }

    /**
    *  @description open the modal by nullifying the inputs
    */
    addEvent(event) {
        this.startDate = null;
        this.endDate = null;
        this.title = null;
        this.openModal = true;
    }

    // TODO: add the logic to support multiple input texts
    handleKeyup(event) {
        this.title = event.target.value;
    }

    /**
     * @description method to show toast events
     */
    showNotification(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }
}