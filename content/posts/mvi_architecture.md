+++
title = 'MVI Architecture Helper'
date = 2024-09-27T13:45:09+02:00
tags = ['kotlin', 'kmp', 'android', 'mvi']
draft = true
+++
Something smart to talk about this helper class

{{< highlight kotlin >}}
interface StateReceiver<STATE> {
    suspend fun updateState(transform: suspend (STATE) -> STATE)
    suspend fun withState(block: suspend (STATE) -> Unit)
}

suspend inline fun <reified TYPE : STATE, STATE> StateReceiver<STATE>.withType(crossinline block: suspend (TYPE) -> Unit) {
    withState { state ->
        if (state is TYPE) {
            block(state)
        }
    }
}

suspend inline fun <reified TYPE : STATE, STATE> StateReceiver<STATE>.updateWithType(crossinline transform: suspend (TYPE) -> TYPE) {
    withType<TYPE, STATE> { state -> updateState { transform(state) } }
}

interface StateProvider<STATE> {
    val state: StateFlow<STATE>
}

interface IntentReceiver<INTENT> {
    fun handleIntent(intent: INTENT)
}

interface ActionProvider<ACTION> {
    val action: Flow<ACTION>
}

interface ActionReceiver<ACTION> {
    suspend fun sendAction(block: suspend () -> ACTION)
}

interface StateModule<STATE> : StateReceiver<STATE>, StateProvider<STATE>
interface IntentModule<INTENT> : IntentReceiver<INTENT>
interface ActionModule<ACTION> : ActionReceiver<ACTION>, ActionProvider<ACTION>

interface MVIViewModel<STATE, INTENT, ACTION> :
    StateModule<STATE>,
    IntentModule<INTENT>,
    ActionModule<ACTION>

class MVIViewModelDelegate<STATE, INTENT, ACTION>(
    initial: STATE
) : MVIViewModel<STATE, INTENT, ACTION> {

    private val _state = MutableStateFlow(initial)
    override val state: StateFlow<STATE> = _state.asStateFlow()

    private val _action = Channel<ACTION>()
    override val action: Flow<ACTION> = _action.receiveAsFlow()

    override suspend fun updateState(transform: suspend (STATE) -> STATE) {
        _state.update { transform(it) }
    }

    override suspend fun withState(block: suspend (STATE) -> Unit) {
        block(_state.value)
    }

    override suspend fun sendAction(block: suspend () -> ACTION) {
        _action.trySend(block())
    }

    override fun handleIntent(intent: INTENT) {
        throw NotImplementedError()
    }
}
{{< / highlight >}}
