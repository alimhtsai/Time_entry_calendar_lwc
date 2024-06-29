import { LightningElement, track, wire } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { refreshApex } from '@salesforce/apex';
import LightningConfirm from 'lightning/confirm';
import FullCalendarJS from '@salesforce/resourceUrl/FullCalendarJS';
import createEvent from '@salesforce/apex/CalendarController.createEvent';
import fetchEvents from '@salesforce/apex/CalendarController.fetchEvents';
import deleteEvent from '@salesforce/apex/CalendarController.deleteEvent';

const DEFAULT_EVENT_FORM = {
    title: "",
    start: "",
    end: ""
}

/**
 * FullCalendarJs
 * @description Full Calendar JS - Lightning Web Components
 */
export default class FullCalendarJs extends LightningElement {

    // to avoid the recursion from renderedcallback
    fullCalendarJsInitialised = false;

    curEvent = DEFAULT_EVENT_FORM;

    // fields to store the event data
    title;
    startDate;
    endDate;

    // selected event id
    selectedRecordId;

    eventsRendered = false; // to render initial events only once
    openSpinner = false; // to open the spinner in waiting screens
    openModal = false; // to open form

    @track
    events = []; // all calendar events are stored in this field

    // to store the orignal wire object to use in refreshApex method
    eventOriginalData = [];

    // Get data from server
    @wire(fetchEvents)
    eventList(value) {
        this.eventOriginalData = value; // to use in refresh cache
        const { data, error } = value;

        if (data) {
            // format as fullcalendar event object
            this.events = data.map(event => {
                return {
                    id: event.Id,
                    title: event.Name,
                    start: event.StartDateTime__c,
                    end: event.EndDateTime__c
                };
            });

            console.log('this.events: ', JSON.stringify(this.events));
            console.log('this.eventsRendered: ', this.eventsRendered);
            console.log('this.fullCalendarJsInitialised: ', this.fullCalendarJsInitialised);
            
            // load only on first wire call
            // if events are not rendered, try to remove this 'if' condition and add directly 
            // documentation: https://fullcalendar.io/docs/v3/renderEvents
            if (!this.eventsRendered && !this.fullCalendarJsInitialised) {
                // add events to calendar
                console.log('test');
                const ele = this.template.querySelector("div.fullcalendarjs");
                $(ele).fullCalendar('renderEvents', JSON.stringify(this.events), true);
                this.eventsRendered = true;
            }

        } else if (error) {
            this.events = [];
            // this.error = 'No events are found';
            console.error('Error occured in fetching', error)
            this.showToast(error.message.body, 'error');
        }
    }

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
                this.fullCalendarJsInitialised = true;
                console.log('fullCalendarJsInitialised', this.fullCalendarJsInitialised);
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

        // Ensure jQuery is loaded
        if (typeof $ !== 'function') {
            console.error('jQuery is not loaded');
            return;
        }

        const ele = this.template.querySelector('div.fullcalendarjs');
        const modal = this.template.querySelector('div.modalclass');

        var self = this;

        // to open the form with predefined fields
        // TODO: to be moved outside this function
        function openActivityForm(startDate, endDate) {
            self.curEvent.start = startDate;
            self.curEvent.end = endDate;
            self.openModal = true;
        }

        $(ele).fullCalendar({
            header: {
                left: 'prev, next today',
                center: 'title',
                right: 'month, agendaWeek, basicDay'
            },
            navLinks: true,
            defaultDate: new Date(), // default day is today
            navLinks: true, // can click day/week names to navigate views
            editable: true,
            selectable: true, // to select the period of time

            // to select the time period : https://fullcalendar.io/docs/v3/select-method
            select: function (startDate, endDate) {
                let stDate = startDate.format();
                let edDate = endDate.format();
                openActivityForm(stDate, edDate);
            },

            eventLimit: true, // allow "more" link when too many events
            events: this.events, // all the events that are to be rendered - can be a duplicate statement here
            timeFormat: 'h:mmt'
        });
    }

    /**
     * @description cancel create a new event
     */
    handleCancel() {
        this.openModal = false;
        this.selectedRecordId = null;
        this.curEvent = DEFAULT_EVENT_FORM;
    }

    handleSave(event) {
        event.preventDefault();
        this.saveEvent();
    }

    /**
     * @description Save a new event
     * @param {*} event 
     */
    saveEvent() {
        let events = this.events;
        this.openSpinner = true;

        // get all the field values - as of now they all are mandatory to create a standard event
        this.template.querySelectorAll('lightning-input').forEach(ele => {
            if (ele.name === 'title') {
                this.title = ele.value;
            }
            if (ele.name === 'start') {
                this.startDate = new Date(ele.value);
                // this.startDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
            }
            if (ele.name === 'end') {
                this.endDate = new Date(ele.value);
                // this.endDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
            }
        });

        // getTimezoneOffset() returns the difference in minutes
        // let utcStartDate = new Date(this.startDate.getTime() + (this.startDate.getTimezoneOffset() * 60000));
        // let utcEndDate = new Date(this.endDate.getTime() + (this.endDate.getTimezoneOffset() * 60000));
        
        // format as per fullcalendar event object to create and render
        let newevent = {
            title: this.title,
            // start: this.startDate.toISOString(),
            // end: this.endDate.toISOString()
            start: this.startDate,
            end: this.endDate
        };

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
                // documentation: https://fullcalendar.io/docs/v3/renderEvent
                $(ele).fullCalendar('renderEvent', newevent, true);

                // to display on UI with id from server
                this.events.push(newevent);

                // to close spinner and modal
                this.openSpinner = false;

                // show success toast message
                this.showToast('Your event is created!', 'success');

            })
            .catch(error => {
                console.log(error);
                this.openSpinner = false;

                // show error toast message
                this.showToast(error.message.body, 'error');
            })
    }

    /**
    *  @description open the modal by nullifying the inputs
    */
    addEventHandler() {
        this.openModal = true;
        this.startDate = null;
        this.endDate = null;
        this.title = null;
    }

    /**
     * @description: handle removal event
     */
    removeEventHandler(event) {
        this.selectedRecordId = event.target.dataset.recordid;
        console.log('selectedRecordId: ', this.selectedRecordId);
        this.handleConfirm();
    }

    async handleConfirm() {
        const result = await LightningConfirm.open({
            message: 'Are you sure you want to delete this event?',
            variant: 'headerless',
            label: 'Delete Confirmation'
        });
        if (result) {
            this.removeEvent();
        }
    }

    /**
    * @description: remove the event with id
    * @documentation: https://fullcalendar.io/docs/v3/removeEvents
    */
    removeEvent(event) {
        // open the spinner
        this.openSpinner = true;

        // delete the event from server and then remove from UI
        deleteEvent({ eventid: this.selectedRecordId })
            .then(result => {
                const ele = this.template.querySelector("div.fullcalendarjs");
                $(ele).fullCalendar('removeEvents', [this.selectedRecordId]);

                this.showToast('Your event is deleted!', 'success');
                this.openSpinner = false;
                this.selectedRecordId = null

                // refresh the grid
                this.refresh();
            })
            .catch(error => {
                console.log(error);
                this.showToast(error.message.body, 'error');
                this.openSpinner = false;
            });
    }

    editEventHandler(event) {
        this.selectedRecordId = event.target.dataset.recordid;

        const eventRecord = this.events.find(item => item.id === this.selectedRecordId);
        console.log('eventRecord: ', JSON.stringify(eventRecord));

        this.curEvent = {
            title: eventRecord.title,
            start: eventRecord.start,
            end: eventRecord.end
        }

        console.log('this.curEvent: ', JSON.stringify(this.curEvent));
        this.openModal = true;
    }

    handleKeyup(event) {
        this.title = event.target.value;
    }

    // changeHandler(event) {
    //     const {name, value} = event.target;
    //     this.curEvent = {...this.curEvent, [name]:value};
    //     console.log('this.curEvent: ', JSON.stringify(this.curEvent));
    // }

    /**
     * @description method to show toast events
     */
    showToast(message, variant) {
        const toast = this.template.querySelector('c-notification');
        if (toast) {
            toast.showToast(message, variant);
        };
    }

    // Helper method to convert UTC datetime to local datetime
    convertToLocalTime(utcDatetime) {
        let localDatetime = new Date(utcDatetime);
        return localDatetime.toLocaleString();
    }

    refresh() {
        return refreshApex(this.eventOriginalData);
    }

    get ModalName() {
        return this.selectedRecordId ? "Update Event" : "Add Event";
    }
}