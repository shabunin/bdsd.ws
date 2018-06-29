## Hello, friend

This module provide simple websocket interface for bdsd.sock daemon.

## Installation

First of all, install Weinzierl BAOS 838 kBerry, set up serial port, install bdsd.sock.

All instructions you can find on [bdsd.sock repository page](https://github.com/bobaos/bdsd.sock).

## Usage with SimpSharpPro:

```csharp
using System;

using Crestron.SimplSharp;                          	// For Basic SIMPL# Classes
using Crestron.SimplSharpPro;                       	// For Basic SIMPL#Pro classes
using Crestron.SimplSharpPro.CrestronThread;        	// For Threading
using Crestron.SimplSharpPro.Diagnostics;		    	// For System Monitor Access
using Crestron.SimplSharpPro.DeviceSupport;         	// For Generic Device Support
using Crestron.SimplSharpPro.UI;
using Crestron.SimplSharp.CrestronIO;                   // For user interfaces
using Crestron.SimplSharp.CrestronWebSocketClient;
using Crestron.SimplSharp.Net.Https;    // For access to HTTPS
using Crestron.SimplSharp.Net;          // For access to HTTPS
using Newtonsoft.Json;


namespace SIMPLSharpProgram1
{
    public class ControlSystem : CrestronControlSystem
    {
        // BOBAOS ===============================//
        public class BobaosValue {
            public string method;
            public int id;
            public string value;
        }
        public string BobaosSetValue(int id, int value) {
            string res = "{";
            res += "\"method\": \"set value\",";
            res += "\"id\":" + id.ToString() + ", ";
            res += "\"value\":" + value.ToString();
            res += "}";
            return res;
        }
        public string BobaosSetValue(int id, bool value) {
            string res = "{";
            res += "\"method\": \"set value\",";
            res += "\"id\":" + id.ToString() + ", ";
            res += "\"value\":" + (value ? "true" : "false");
            res += "}";
            return res;
        }
        //=======================================//


        public Tsw760 small_EntryPanel;

        // WS
        public WebSocketClient wsc = new WebSocketClient();
        public WebSocketClient.WEBSOCKET_RESULT_CODES ret;

        WebSocketClient.WEBSOCKET_RESULT_CODES wrc;
        private CTimer keepAliveTimer;
        /// <summary>
        /// ControlSystem Constructor. Starting point for the SIMPL#Pro program.
        /// Use the constructor to:
        /// * Initialize the maximum number of threads (max = 400)
        /// * Register devices
        /// * Register event handlers
        /// * Add Console Commands
        ///
        /// Please be aware that the constructor needs to exit quickly; if it doesn't
        /// exit in time, the SIMPL#Pro program will exit.
        ///
        /// You cannot send / receive data in the constructor
        /// </summary>
        public ControlSystem()
            : base()
        {
            try
            {
                Thread.MaxNumberOfUserThreads = 20;
                //Subscribe to the controller events (System, Program, and Ethernet)
                CrestronEnvironment.SystemEventHandler += new SystemEventHandler(ControlSystem_ControllerSystemEventHandler);
                CrestronEnvironment.ProgramStatusEventHandler += new ProgramStatusEventHandler(ControlSystem_ControllerProgramEventHandler);
                CrestronEnvironment.EthernetEventHandler += new EthernetEventHandler(ControlSystem_ControllerEthernetEventHandler);

            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("Error in the constructor: {0}" + e.Message);
            }
        }

        void small_EntryPanel_SigChange(BasicTriList currentDevice, SigEventArgs args)
        {
            try
            {
                switch (args.Sig.Number)
                {
                    case 10:
                        string msg = BobaosSetValue(22, args.Sig.BoolValue);
                        CrestronConsole.PrintLine("sending " + msg);
                        wsc.SendAsync(System.Text.Encoding.ASCII.GetBytes(msg), (uint)msg.Length, WebSocketClient.WEBSOCKET_PACKET_TYPES.LWS_WS_OPCODE_07__TEXT_FRAME, WebSocketClient.WEBSOCKET_PACKET_SEGMENT_CONTROL.WEBSOCKET_CLIENT_PACKET_END);
                        break;
                    default:
                        break;
                }
            }
            catch (Exception e)
            {
                Disconnect();
            }
        }






        /// <summary>
        /// InitializeSystem - this method gets called after the constructor
        /// has finished.
        ///
        /// Use InitializeSystem to:
        /// * Start threads
        /// * Configure ports, such as serial and verisports
        /// * Start and initialize socket connections
        /// Send initial device configurations
        ///
        /// Please be aware that InitializeSystem needs to exit quickly also;
        /// if it doesn't exit in time, the SIMPL#Pro program will exit.
        /// </summary>
        public override void InitializeSystem()
        {
            try
            {
                CrestronConsole.PrintLine("hello, friend");
                small_EntryPanel = new Tsw760(3, this);
                small_EntryPanel.SigChange += new SigEventHandler(small_EntryPanel_SigChange);
                small_EntryPanel.Register();

                try
                {
                    wsc.Host = "192.168.4.201";
                    wsc.Port = 49198;
                    wsc.URL = "ws://192.168.4.201:49198/";
                    wsc.KeepAlive = true;
                    wsc.ReceiveCallBack = ReceiveCallback;
                    wsc.DisconnectCallBack = DisconnectCallBack;
                    wrc = wsc.Connect();
                    keepAliveTimer = new CTimer(keepAliveCheck, null, 1000, 5000);
                    CrestronConsole.PrintLine("Connecting to: " + wsc.Host.ToString() + ":" + wsc.Port.ToString() + ". URL: " + wsc.URL);

                    if (wrc == (int)WebSocketClient.WEBSOCKET_RESULT_CODES.WEBSOCKET_CLIENT_SUCCESS)
                    {
                        CrestronConsole.PrintLine("Websocket connected \r\n");
                        wsc.ReceiveAsync();
                    }
                    else
                    {
                        CrestronConsole.PrintLine("WS Connect return code: " + wrc.ToString());
                    }
                }
                catch (Exception ce)
                {
                    CrestronConsole.PrintLine(ce.ToString());
                }

            }
            catch (Exception e)
            {
                ErrorLog.Error("Error in InitializeSystem: {0}", e.Message);
            }
        }

        /// <summary>
        /// Event Handler for Ethernet events: Link Up and Link Down.
        /// Use these events to close / re-open sockets, etc.
        /// </summary>
        /// <param name="ethernetEventArgs">This parameter holds the values
        /// such as whether it's a Link Up or Link Down event. It will also indicate
        /// wich Ethernet adapter this event belongs to.
        /// </param>
        void ControlSystem_ControllerEthernetEventHandler(EthernetEventArgs ethernetEventArgs)
        {
            switch (ethernetEventArgs.EthernetEventType)
            {//Determine the event type Link Up or Link Down
                case (eEthernetEventType.LinkDown):
                    //Next need to determine which adapter the event is for.
                    //LAN is the adapter is the port connected to external networks.
                    if (ethernetEventArgs.EthernetAdapter == EthernetAdapterType.EthernetLANAdapter)
                    {
                        //
                    }
                    break;
                case (eEthernetEventType.LinkUp):
                    if (ethernetEventArgs.EthernetAdapter == EthernetAdapterType.EthernetLANAdapter)
                    {

                    }
                    break;
            }
        }

        /// <summary>
        /// Event Handler for Programmatic events: Stop, Pause, Resume.
        /// Use this event to clean up when a program is stopping, pausing, and resuming.
        /// This event only applies to this SIMPL#Pro program, it doesn't receive events
        /// for other programs stopping
        /// </summary>
        /// <param name="programStatusEventType"></param>
        void ControlSystem_ControllerProgramEventHandler(eProgramStatusEventType programStatusEventType)
        {
            switch (programStatusEventType)
            {
                case (eProgramStatusEventType.Paused):
                    //The program has been paused.  Pause all user threads/timers as needed.
                    break;
                case (eProgramStatusEventType.Resumed):
                    //The program has been resumed. Resume all the user threads/timers as needed.
                    break;
                case (eProgramStatusEventType.Stopping):
                    //The program has been stopped.
                    //Close all threads.
                    //Shutdown all Client/Servers in the system.
                    //General cleanup.
                    //Unsubscribe to all System Monitor events
                    break;
            }

        }
        /// <summary>
        /// Event Handler for system events, Disk Inserted/Ejected, and Reboot
        /// Use this event to clean up when someone types in reboot, or when your SD /USB
        /// removable media is ejected / re-inserted.
        /// </summary>
        /// <param name="systemEventType"></param>
        void ControlSystem_ControllerSystemEventHandler(eSystemEventType systemEventType)
        {
            switch (systemEventType)
            {
                case (eSystemEventType.DiskInserted):
                    //Removable media was detected on the system
                    break;
                case (eSystemEventType.DiskRemoved):
                    //Removable media was detached from the system
                    break;
                case (eSystemEventType.Rebooting):
                    //The system is rebooting.
                    //Very limited time to preform clean up and save any settings to disk.
                    break;
            }

        }
        /// <summary>
        /// The Following Three Methods are for the Websocket Listener
        /// </summary>
        /// <param name="error"></param>
        /// <returns></returns>
        /**
        public int SendCallback(WebSocketClient.WEBSOCKET_RESULT_CODES error)
        {
            try
            {
                ret = wsc.ReceiveAsync();
            }
            catch (Exception e)
            {
                return -1;
            }

            return 0;
        } **/
        public int ReceiveCallback(byte[] data, uint datalen, WebSocketClient.WEBSOCKET_PACKET_TYPES opcode, WebSocketClient.WEBSOCKET_RESULT_CODES error)
        {
            try
            {
                string s = System.Text.Encoding.UTF8.GetString(data, 0, data.Length);
                BobaosValue rec = JsonConvert.DeserializeObject<BobaosValue>(s);
                CrestronConsole.PrintLine("Received from ws. method: " + rec.method + ", id: " + rec.id + ", value: " + rec.value);
                wsc.ReceiveAsync();
            }
            catch (Exception e)
            {
                return -1;
            }
            return 0;
        }
        public int DisconnectCallBack(WebSocketClient.WEBSOCKET_RESULT_CODES error, object obj)
        {
            try
            {
                    CrestronConsole.Print("\n Websocket DisconnectCallBack error: " + error.ToString());
            }
            catch (Exception e)
            {
                    CrestronConsole.Print("\n Websocket DisconnectCallBack exception: " + e.Message);
                return -1;
            }
            return 0;
        }
        private void keepAliveCheck(object obj) {
            bool connected = wsc.Connected;
            if (!connected)
            {
                try
                {
                    CrestronConsole.PrintLine("ws client disconnected, reconnectin");
                    wsc.Connect();
                    if (wrc == (int)WebSocketClient.WEBSOCKET_RESULT_CODES.WEBSOCKET_CLIENT_SUCCESS)
                    {
                        CrestronConsole.PrintLine("Websocket reconnected \r\n");
                        wsc.ReceiveAsync();
                    }
                    else
                    {
                        CrestronConsole.PrintLine("WS ReConnect return code: " + wrc.ToString());
                    }
                }
                catch (Exception e)
                {
                    CrestronConsole.PrintLine("exception while reconnecting to ws", e.Message);
                }
            }
        }

        public void Disconnect()
        {
            wsc.Disconnect();
            CrestronConsole.PrintLine("Websocket disconnected. \r\n");
        }

        /**
        public void AsyncSendAndReceive()
        {
            try
            {
                wsc.SendAsync(SendData, (uint)SendData.Length, WebSocketClient.WEBSOCKET_PACKET_TYPES.LWS_WS_OPCODE_07__TEXT_FRAME, WebSocketClient.WEBSOCKET_PACKET_SEGMENT_CONTROL.WEBSOCKET_CLIENT_PACKET_END);
            }
            catch (Exception e)
            {
                Disconnect();
            }
        }
         * **/
    }
}
```
